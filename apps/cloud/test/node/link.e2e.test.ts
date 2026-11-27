// The laptop link end to end: a fake relay (playing the show page's journal events) → the link → the real Worker
// under `wrangler dev` → a phone. Includes Plan B: the cloud is unreachable while the show goes on, and the link
// catches up when it comes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL_VERSION, replayJournal, type JournalEntry } from '@quina/protocol';
import { CloudLink } from '../../laptop/link.ts';
import { fakeRelay } from '../../loadtest/fake-relay.ts';
import { freePort, startDevServer, type DevServer } from '../../loadtest/dev-server.ts';
import { followFeed, type PublicView } from '@quina/protocol';
import type { EditionExport } from '../../src/api.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { PLAN } from '../support/plan.ts';
import { tempDir } from '../support/temp.ts';

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
    dataDir: tempDir('quina-link-e2e-'),
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
  const file = path.join(link.journal.dir, 'cloud-plan.json');
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8')) as { savedAtMs: number; plan: typeof PLAN | null };
  try {
    link.start();
    await until('the link on the cloud', () => link.status().cloud === 'online');
    const saved = await fetch(`${server.http}/api/plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PLAN) });
    assert.equal(saved.status, 200);
    await until('the plan on disk', () => fs.existsSync(file) && read().plan?.title === PLAN.title);
    assert.deepEqual(read().plan, PLAN);
    assert.ok(read().savedAtMs > 0);
    assert.equal(link.status().plan?.title, PLAN.title);
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});

test("the plan's logos are copied to the laptop, with their JPEG XL when there is one", async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const link = makeLink(relay.url, server.ws);
  const dir = path.join(link.journal.dir, 'media');
  const png = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n]);
  const upload = async (bytes: Uint8Array) => ((await (await fetch(`${server.http}/api/media`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: bytes })).json()) as { path: string; key: string });
  try {
    const withJxl = await upload(png(1));
    const withoutJxl = await upload(png(2));
    const jxl = new Uint8Array([0xff, 0x0a, 5, 5]);
    assert.equal((await fetch(`${server.http}/api/media/${withJxl.key}.jxl`, { method: 'PUT', headers: { 'content-type': 'image/jxl' }, body: jxl })).status, 201);
    const plan = { ...PLAN, sponsors: [{ id: 'forn', name: 'Forn', logo: withJxl.path }, { id: 'croak', name: 'Croak', logo: withoutJxl.path }] };
    assert.equal((await fetch(`${server.http}/api/plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) })).status, 200);
    link.start();
    await until('the logos on disk', () => fs.existsSync(path.join(dir, `${withJxl.key}.png`)) && fs.existsSync(path.join(dir, `${withoutJxl.key}.png`)) && fs.existsSync(path.join(dir, `${withJxl.key}.jxl`)));
    assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(dir, `${withJxl.key}.jxl`))), jxl);
    assert.deepEqual(new Uint8Array(fs.readFileSync(path.join(dir, `${withoutJxl.key}.png`))), png(2));
    // No JPEG XL uploaded: none is kept (the relay answers .jxl with the PNG, as the cloud does).
    assert.equal(fs.existsSync(path.join(dir, `${withoutJxl.key}.jxl`)), false);
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});

test("a plan saved on the laptop with no cloud goes up when the cloud is back, and the cloud's newer one wins", async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const link = makeLink(relay.url, server.ws);
  const local = path.join(link.journal.dir, 'local-plan.json');
  const cloudPlan = async () => ((await (await fetch(`${server.http}/api/plan`)).json()) as { plan: typeof PLAN | null }).plan;
  const put = (plan: typeof PLAN) => fetch(`${server.http}/api/plan`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) });
  try {
    assert.equal((await put(PLAN)).status, 200);
    // Saved on the laptop (the relay's PUT /api/plan writes this file) while the link was away.
    fs.writeFileSync(local, JSON.stringify({ savedAtMs: Date.now(), plan: { ...PLAN, title: 'Desada al portàtil' } }));
    link.start();
    await until('the cloud to take the laptop\'s plan', async () => (await cloudPlan())?.title === 'Desada al portàtil');
    await until('the local copy to go once the cloud has it', () => !fs.existsSync(local));

    // Admin saves on the laptop again, and then in the cloud: the cloud's later save wins, the laptop's goes.
    fs.writeFileSync(local, JSON.stringify({ savedAtMs: Date.now() - 60_000, plan: { ...PLAN, title: 'Antiga' } }));
    relay.emit({ v, type: 'relay.plan', plan: null, savedAtMs: null }); // the relay saw the file change
    await until('the cloud to answer the older save', () => !fs.existsSync(local));
    assert.equal((await cloudPlan())?.title, 'Desada al portàtil');
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});

test("a new laptop copies the cloud's Game; Admin's manual resume leaves resume.json for the show page", async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const old = makeLink(relay.url, server.ws);
  const game = JournalBuilder.sampleGame('g-takeover', Date.now() - 3_600_000);
  let fresh: CloudLink | null = null;
  try {
    old.start();
    await until('the old laptop online', () => old.status().cloud === 'online');
    relay.journal(game.entries);
    await until('the cloud to have the Game', () => old.status().ackSeq === game.entries.length);
    old.stop();

    const otherRelay = await fakeRelay(); // the new laptop's show page has nothing yet
    fresh = makeLink(otherRelay.url, server.ws);
    fresh.start();
    await until('the new laptop to copy the Game', () => fresh?.journal.contiguous('g-takeover') === game.entries.length);
    assert.equal(fresh.journal.currentGameId, 'g-takeover');
    assert.deepEqual(fresh.journal.slice('g-takeover', 1, game.entries.length), game.entries);

    const answer = await fetch(`${server.http}/api/resume`, { method: 'POST', body: JSON.stringify({ gameId: 'g-takeover' }) });
    assert.equal(answer.status, 200);
    const file = path.join(fresh.journal.dir, 'resume.json');
    await until('resume.json', () => fs.existsSync(file));
    assert.deepEqual(
      (({ gameId, seq, by }) => ({ gameId, seq, by }))(JSON.parse(fs.readFileSync(file, 'utf8'))),
      { gameId: 'g-takeover', seq: game.entries.length, by: 'dev' },
    );
    await otherRelay.close();
  } finally {
    old.stop();
    fresh?.stop();
    await relay.close();
    await server.stop();
  }
});

test('a hole in the journal copy is asked for again until filled, even after a request the rate limit skipped', async () => {
  const relay = await fakeRelay();
  // No cloud needed: the journal copy and its requests to the show are the link's own.
  const link = makeLink(relay.url, 'ws://127.0.0.1:9');
  const asks = () => relay.received.filter((m) => (m as { cmd?: string }).cmd === 'getJournal') as { fromSeq: number }[];
  try {
    link.start();
    await until('the link on the relay', () => link.status().relay);
    // The show page connects: the link asks for its journal from 1 (nothing there yet)…
    relay.emit({ v, type: 'relay.clients', clients: [{ role: 'show', clientId: 'show' }] });
    await until('the first ask', () => asks().length === 1);
    // …then hears entry 2 first (entry 1 went out before it listened): a hole, inside the 5-second limit.
    const game = JournalBuilder.sampleGame('g-hole');
    relay.journal([game.entries[1] as JournalEntry]);
    await until('the hole asked for again', () => asks().length >= 2, 8_000);
    assert.equal(asks().at(-1)?.fromSeq, 1);
    relay.emit({ v, type: 'journal.entries', reqId: 'x', gameId: 'g-hole', entries: game.entries.slice(0, 2) });
    await until('the hole filled', () => link.status().journalled === 2);
  } finally {
    link.stop();
    await relay.close();
  }
});
