// D234's lock through the cloud: the relay keeps the `from` the cloud stamped (cloud:<id>) on the link's socket only, and
// folds the link's `cloud.consoles` into relay.clients (protocol commands.ts stampCommandFrom, events.ts cloud.consoles).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_CONSOLES_MAX, PROTOCOL_VERSION, checkCommand, cloudConsolesMessage, isCloudConsoleId, makeCommand, readCloudConsoles, stampCommandFrom,
  withCloudConsoles,
} from '@quina/protocol';
import { dataTest } from './support/data.ts';
import { setup } from './support/harness.ts';

const LINK = 'cloud-link-1';
const stamped = (from: unknown, clientId: string, viaCloud?: boolean) => {
  const message: Record<string, unknown> = { ...makeCommand('twoLevelHold', { button: 'hold', on: true }), ...(from === undefined ? {} : { from }) };
  stampCommandFrom(message, clientId, viaCloud === undefined ? undefined : { viaCloud });
  return message;
};

test('isCloudConsoleId: cloud: and a plain id of 1–64 [A-Za-z0-9_-]', () => {
  for (const ok of ['cloud:a', 'cloud:Tablet_2-b', `cloud:${'x'.repeat(64)}`]) assert.ok(isCloudConsoleId(ok), ok);
  for (const bad of ['cloud:', `cloud:${'x'.repeat(65)}`, 'cloud:a b', 'cloud:a:b', 'cloud:é', 'Cloud:a', 'tablet-1', ' cloud:a', 7, null, undefined]) {
    assert.equal(isCloudConsoleId(bad), false, String(bad));
  }
});

test('the cloud socket keeps a valid cloud: from, replaces any other with the link\'s, and stamps the link\'s when there is none', () => {
  assert.equal(stamped('cloud:tablet-7', LINK, true).from, 'cloud:tablet-7');
  for (const bad of ['tablet-7', 'cloud:', 'cloud:a/b', `cloud:${'x'.repeat(65)}`, 7, '']) assert.equal(stamped(bad, LINK, true).from, LINK, String(bad));
  assert.equal(stamped(undefined, LINK, true).from, LINK);
  assert.equal('from' in stamped('tablet-7', '', true), false, 'a link without a clientId: none');
  assert.ok(checkCommand(stamped('cloud:tablet-7', LINK, true)).ok);
});

test('any other socket always overwrites, even a cloud: from', () => {
  for (const viaCloud of [false, undefined]) {
    assert.equal(stamped('cloud:tablet-7', 'lan-tablet', viaCloud).from, 'lan-tablet');
    assert.equal(stamped(undefined, 'lan-tablet', viaCloud).from, 'lan-tablet');
    assert.equal('from' in stamped('cloud:tablet-7', '', viaCloud), false, 'no clientId: none, never the forged one');
  }
});

test('cloud.consoles: read only when every id is a cloud console\'s, at most CLOUD_CONSOLES_MAX', () => {
  assert.deepEqual(readCloudConsoles(cloudConsolesMessage(['cloud:a', 'cloud:b'])), ['cloud:a', 'cloud:b']);
  assert.deepEqual(readCloudConsoles(cloudConsolesMessage([])), []);
  assert.deepEqual(readCloudConsoles(cloudConsolesMessage(['cloud:a', 'cloud:a'])), ['cloud:a'], 'duplicates once');
  const max = Array.from({ length: CLOUD_CONSOLES_MAX }, (_, i) => `cloud:c${i}`);
  assert.equal(readCloudConsoles(cloudConsolesMessage(max))?.length, CLOUD_CONSOLES_MAX);
  assert.equal(readCloudConsoles(cloudConsolesMessage([...max, 'cloud:one-more'])), null);
  assert.equal(readCloudConsoles(cloudConsolesMessage(['cloud:a', 'tablet-1'])), null, 'one bad id: the whole list is ignored');
  assert.equal(readCloudConsoles({ v: PROTOCOL_VERSION, type: 'cloud.consoles', ids: 'cloud:a' }), null);
  assert.equal(readCloudConsoles({ v: PROTOCOL_VERSION, type: 'cloud.consoles', ids: [7] }), null);
  assert.equal(readCloudConsoles({ v: 0, type: 'cloud.consoles', ids: [] }), null);
  assert.equal(readCloudConsoles({ v: PROTOCOL_VERSION, type: 'relay.clients', ids: [] }), null);
  assert.equal(readCloudConsoles(null), null);
});

test('relay.clients folds the cloud consoles in as role console, after the sockets', () => {
  const own = [{ role: 'show' as const, clientId: 'show-1' }, { role: 'cloud' as const, clientId: LINK }];
  assert.deepEqual(withCloudConsoles(own, ['cloud:a']), [...own, { role: 'console', clientId: 'cloud:a' }]);
  assert.deepEqual(withCloudConsoles(own, []), own, 'no cloud consoles (or the link gone): the sockets only');
});

dataTest('the engine: two consoles through the cloud are two senders, and one that leaves the folded list lets go', () => {
  const h = setup({ seed: 3 });
  h.send('unlock');
  // As the relay forwards them: each keeps the cloud's cloud:<id>.
  const via = (from: string, on: boolean, cmd: 'twoLevelHold' | 'pause' = 'twoLevelHold') => {
    const message: Record<string, unknown> = { ...(cmd === 'pause' ? makeCommand('pause', { on }) : makeCommand('twoLevelHold', { button: 'hold', on })), from };
    stampCommandFrom(message, LINK, { viaCloud: true });
    return h.dispatch(message);
  };
  via('cloud:tablet-a', true);
  assert.equal(h.show.snapshot().twoLevelHeld?.clientId, 'cloud:tablet-a');
  const refused = via('cloud:tablet-b', true, 'pause').filter((e) => e.type === 'reject');
  assert.deepEqual(refused.map((e) => e.type === 'reject' && e.reason), ['busy'], 'the other cloud console is refused');
  const clientIds = (cloud: string[]) => withCloudConsoles([{ role: 'show', clientId: 'show-1' }, { role: 'cloud', clientId: LINK }], cloud).map((c) => c.clientId);
  h.show.clientsChanged(clientIds(['cloud:tablet-a', 'cloud:tablet-b']));
  assert.equal(h.show.snapshot().twoLevelHeld?.clientId, 'cloud:tablet-a', 'still connected');
  h.show.clientsChanged(clientIds(['cloud:tablet-b']));
  assert.equal(h.show.snapshot().twoLevelHeld, null, 'its holder left the cloud');
});
