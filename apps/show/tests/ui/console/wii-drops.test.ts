// The Wii remote's range: the host counts its drops over a rolling window and every console sums the hosts' reports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropReport, recentDrops } from '../../../../console/wii/drops.ts';
import { RemoteHosts } from '../../../../../packages/ui/client/remote-status.ts';

const MIN = 60_000;

test('drops are counted over the last window; the latest is kept even when it has left it', () => {
  const now = 100 * MIN;
  const times = [now - 30 * MIN, now - 9 * MIN, now - 2 * MIN];
  assert.deepEqual(recentDrops(times, now, 10 * MIN), [now - 9 * MIN, now - 2 * MIN]);
  assert.deepEqual(dropReport(times, now, 10 * MIN), { drops: 2, lastDropMs: now - 2 * MIN });
  assert.deepEqual(dropReport([now - 30 * MIN], now, 10 * MIN), { drops: 0, lastDropMs: now - 30 * MIN });
  assert.deepEqual(dropReport([], now, 10 * MIN), { drops: 0, lastDropMs: null });
});

test("every console sums the hosts' drops; a new count alone is news", () => {
  const hosts = new RemoteHosts();
  assert.equal(hosts.apply('laptop', { connected: true, battery: 0.8, sinceMs: 0, drops: 1 }), true);
  assert.equal(hosts.apply('laptop', { connected: true, battery: 0.8, sinceMs: 0, drops: 3 }), true, 'only the count changed');
  assert.equal(hosts.apply('laptop', { connected: true, battery: 0.8, sinceMs: 0, drops: 3 }), false);
  hosts.apply('spare', { connected: false, battery: null, sinceMs: 0 });
  assert.equal(hosts.summary().drops, 3, 'a host that reports none adds none');
});
