// The preflight's cloud checks against the real Worker under `wrangler dev`, with a running laptop link: the
// sign-in and clock check, the link's status file and the Game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CloudLink } from '../../laptop/link.ts';
import { runPreflight } from '../../laptop/preflight/gather.ts';
import { startDevServer } from '../../loadtest/dev-server.ts';
import { fakeRelay } from '../../loadtest/fake-relay.ts';
import { JournalBuilder } from '../support/journal-builder.ts';

test('preflight, cloud: signed in with a sane clock, the link in sync, the same Game here and there', async () => {
  const server = await startDevServer();
  const relay = await fakeRelay();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-preflight-e2e-'));
  const link = new CloudLink({ relayUrl: relay.url, cloudUrl: `${server.ws}/ws/show`, cloudHeaders: {}, dataDir, clientId: 'laptop-preflight', log: () => {} });
  const options = { relay: 'http://127.0.0.1:9', cloud: server.http, headers: {}, dataDir, fast: true, only: ['Cloud'] as const };
  try {
    const before = await runPreflight({ ...options, only: ['Cloud'] });
    assert.equal(before.find((c) => c.name === 'Cloud link')?.status, 'fail', 'no link yet');

    link.start();
    const deadline = Date.now() + 15_000;
    while (link.status().cloud !== 'online' && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    relay.journal(new JournalBuilder('g-preflight', Date.now() - 60_000).startRound().land(3).entries);
    while ((link.status().ackSeq < 5 || !fs.existsSync(path.join(dataDir, 'status.json'))) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 5200)); // the status file is rewritten every 5 s

    const checks = await runPreflight(options);
    const status = Object.fromEntries(checks.map((c) => [c.name, c.status]));
    const detail = (name: string) => checks.find((c) => c.name === name)?.detail ?? '';
    assert.equal(status['Cloud'], 'pass');
    assert.equal(status['Laptop sign-in'], 'pass', detail('Laptop sign-in'));
    assert.equal(status['Cloud link'], 'pass', detail('Cloud link'));
    assert.equal(status['Game'], 'pass', detail('Game'));
    assert.match(detail('Game'), /g-preflight/);
  } finally {
    link.stop();
    await relay.close();
    await server.stop();
  }
});
