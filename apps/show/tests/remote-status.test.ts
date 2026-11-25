// The Wii Remote's status between consoles (protocol events.ts remote.status): what a console accepts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, readRemoteStatus, remoteStatusMessage } from '@quina/protocol';

test('remote.status: battery, drops and the last drop are read when well formed, left out otherwise', () => {
  const base = { v: PROTOCOL_VERSION, type: 'remote.status', connected: true, battery: 0.8, sinceMs: 5 };
  assert.deepEqual(readRemoteStatus({ ...base, clientId: 'tablet-1' }), { connected: true, battery: 0.8, sinceMs: 5, clientId: 'tablet-1' }, 'an older host');
  assert.deepEqual(readRemoteStatus({ ...base, drops: 3, lastDropMs: 1200 }), { connected: true, battery: 0.8, sinceMs: 5, drops: 3, lastDropMs: 1200, clientId: '' });
  assert.deepEqual(readRemoteStatus({ ...base, drops: 0, lastDropMs: null })?.lastDropMs, null);
  const odd = readRemoteStatus({ ...base, battery: 7, drops: -1, lastDropMs: 'soon' });
  assert.deepEqual(odd, { connected: true, battery: null, sinceMs: 5, clientId: '' });
  assert.equal(readRemoteStatus({ ...base, drops: 1.5 })?.drops, undefined);
  assert.equal(readRemoteStatus({ ...base, connected: 'yes' }), null);
  assert.deepEqual(readRemoteStatus(remoteStatusMessage({ connected: false, battery: null, sinceMs: 9, drops: 2, lastDropMs: 8 })), { connected: false, battery: null, sinceMs: 9, drops: 2, lastDropMs: 8, clientId: '' });
});
