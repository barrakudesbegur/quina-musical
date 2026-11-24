// The laptop link end to end: a fake relay (playing the show page's journal events) → the link → the real Worker
// under `wrangler dev` → a phone. Includes Plan B: the cloud is unreachable while the show goes on, and the link
// catches up when it comes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION, replayJournal } from '@quina/protocol';
import { CloudLink } from '../../laptop/link.ts';
import { fakeRelay } from '../../loadtest/fake-relay.ts';
import { freePort, startDevServer, type DevServer } from '../../loadtest/dev-server.ts';
import { followFeed, type PublicView } from '../../src/feed/public.ts';
import type { EditionExport } from '../../src/api.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { PLAN } from '../support/plan.ts';

const v = PROTOCOL_VERSION;

async function until(what: string, check: () => boolean | Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function exported(server: DevServer): Promise<EditionExport> {
  return (await (await fetch(`${server.http}/api/export`)).json()) as EditionExport;
}

function makeLink(relayUrl: string, cloudWs: string, lines: string[] = []) {
  return new CloudLink({
    relayUrl,
    cloudUrl: `${cloudWs}/ws/show`,
    cloudHeaders: {},
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'quina-link-e2e-')),
    clientId: 'laptop-test',
    log: (line) => lines.push(line),
    reconnectFirstMs: 100,
    reconnectCapMs: 400,
  });
}

test('the show journals, the link uploads, the cloud agrees and a phone follows', async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const link = makeLink(relay.url, server.ws);
  try {
    link.start();
    await until('the link on the relay', () => relay.received.some((m) => (m as { type?: string }).type === 'hello'));
    assert.ok(relay.received.some((m) => (m as { cmd?: string }).cmd === 'getJournal'), 'it asks the show for its journal');

    const phone = new WebSocket(`${server.ws}/feed?cards=33,77`);
    let view: PublicView | null = null;
    phone.addEventListener('message', (event) => {
      const result = followFeed(view, JSON.parse(String(event.data)));
      assert.notEqual(result.kind, 'resync', 'no gaps');
      if (result.kind === 'ok') view = result.view;
    });

    await until('the link on the cloud', () => link.status().cloud === 'online');
    const game = JournalBuilder.sampleGame('g-e2e', Date.now() - 3_600_000);
    relay.journal(game.entries);
    relay.emit({ v, type: 'transition.scheduled', id: 't', to: 5, drum: { removeId: 1, targetId: 5, minLaps: 1 }, spinStartAtMs: Date.now(), landAtMs: Date.now() + 9000 });
    await until('the cloud to have every entry', () => link.status().ackSeq === game.entries.length);

    const data = await exported(server);
    assert.deepEqual(data.games.find((g) => g.gameId === 'g-e2e')?.record, replayJournal(game.entries));
    await until('the phone to see both rounds and the Spin', () => (view as PublicView | null)?.state.rounds.length === 2 && (view as PublicView | null)?.state.spin !== null);
    phone.close();
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});

test('Plan B: offline, the link keeps the journal on disk and uploads it all when the cloud is back', async () => {
  const port = await freePort();
  const relay = await fakeRelay();
  const lines: string[] = [];
  const link = makeLink(relay.url, `ws://127.0.0.1:${port}`, lines);
  const game = JournalBuilder.sampleGame('g-offline', Date.now() - 3_600_000);
  let server: DevServer | null = null;
  try {
    link.start();
    await until('the link on the relay', () => relay.received.length > 0);
    relay.journal(game.entries.slice(0, 30));
    await until('the journal on disk', () => link.status().journalled === 30);
    assert.equal(link.status().cloud === 'online', false);

    server = await startDevServer({ port });
    relay.journal(game.entries.slice(30));
    await until('the cloud to catch up', () => link.status().ackSeq === game.entries.length, 20_000);
    const data = await exported(server);
    assert.deepEqual(data.games.find((g) => g.gameId === 'g-offline')?.entries, game.entries);
    assert.ok(lines.some((l) => l.includes('retrying')), 'it retried with backoff');
  } finally {
    link.stop();
    await relay.close();
    await server?.stop();
  }
});

test('a second laptop takes over; the first stops instead of fighting back', async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const first = makeLink(relay.url, server.ws);
  const second = makeLink(relay.url, server.ws);
  try {
    first.start();
    await until('the first link online', () => first.status().cloud === 'online');
    second.start();
    await until('the first link replaced', () => first.status().cloud === 'replaced');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assert.equal(second.status().cloud, 'online', 'the second stays connected');
    assert.equal(first.status().cloud, 'replaced');
  } finally {
    first.stop();
    second.stop();
    await relay.close();
    await server.stop();
  }
});

test('a tablet on the cloud drives the show through the link, and sees the full event stream', async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const link = makeLink(relay.url, server.ws);
  try {
    link.start();
    await until('the link on the cloud', () => link.status().cloud === 'online');
    relay.emit({ v, type: 'relay.clients', clients: [{ role: 'show', clientId: 'show-1' }, { role: 'cloud', clientId: 'laptop-test' }] });

    const tablet = new WebSocket(`${server.ws}/ws/console`);
    const seen: { type: string; [key: string]: unknown }[] = [];
    tablet.addEventListener('message', (event) => seen.push(JSON.parse(String(event.data))));
    await new Promise((resolve) => tablet.addEventListener('open', resolve, { once: true }));
    tablet.send(JSON.stringify({ v, type: 'hello', role: 'tablet', clientId: 'Tauleta-e2e' }));
    await until('the link to know a tablet listens', () => link.status().consoles === 1);
    await until('the tablet to see the show online', () => seen.some((m) => m.type === 'relay.clients' && (m.clients as { role: string }[]).some((c) => c.role === 'show')));

    tablet.send(JSON.stringify({ v, type: 'cmd', cmd: 'next', reqId: 'Tauleta-r-1' }));
    await until('the command on the relay', () => relay.received.some((m) => (m as { reqId?: string }).reqId === 'Tauleta-r-1'));

    relay.emit({ v, type: 'claim.opened', claim: { claimId: 'cl-1', cardId: 12 } }); // console-only: sent while a tablet listens
    await until('the tablet to get it', () => seen.some((m) => m.type === 'claim.opened'));

    tablet.close();
    await until('the link to know nobody listens', () => link.status().consoles === 0);
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});

test("the laptop keeps Admin's Game plan on disk, so it has it with no internet", async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const link = makeLink(relay.url, server.ws);
  const file = path.join(link.journal.dir, 'plan.json');
  try {
    link.start();
    await until('the link on the cloud', () => link.status().cloud === 'online');
    const saved = await fetch(`${server.http}/api/plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PLAN) });
    assert.equal(saved.status, 200);
    await until('the plan on disk', () => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8'))?.title === PLAN.title);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), PLAN);
    assert.equal(link.status().plan?.title, PLAN.title);
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});
