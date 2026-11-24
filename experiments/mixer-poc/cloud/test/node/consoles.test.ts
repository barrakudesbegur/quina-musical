// Consoles through the cloud: what the laptop forwards, and who the consoles see connected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES } from '@quina/protocol';
import { ALWAYS_FORWARDED, mergedClients, shouldForward } from '../../src/domain/consoles.ts';

test('the journal and engine health never go out as events; what phones need always does', () => {
  for (const type of ['journal.entry', 'journal.entries', 'engine.health']) {
    assert.equal(shouldForward(type, 0), false, type);
    assert.equal(shouldForward(type, 3), false, `${type} with consoles`);
  }
  for (const type of ALWAYS_FORWARDED) assert.equal(shouldForward(type, 0), true, type);
  assert.ok(shouldForward('relay.clients', 0), 'who is on the relay is tiny and rare');
});

test('everything else goes out only while a console listens through the cloud', () => {
  const consoleOnly = EVENT_TYPES.filter((t) => !ALWAYS_FORWARDED.includes(t) && !['journal.entry', 'journal.entries', 'engine.health'].includes(t));
  assert.ok(consoleOnly.includes('claim.opened'));
  assert.ok(consoleOnly.includes('command.rejected'));
  for (const type of consoleOnly) {
    assert.equal(shouldForward(type, 0), false, type);
    assert.equal(shouldForward(type, 1), true, type);
  }
});

test("consoles see the laptop relay's list only while the laptop link is online, plus the cloud's consoles", () => {
  const relay = [
    { role: 'show' as const, clientId: 'show-1' },
    { role: 'cloud' as const, clientId: 'laptop-ab12' },
  ];
  const cloud = [{ role: 'tablet' as const, clientId: 'Tauleta-3f2a' }];
  assert.deepEqual(mergedClients(relay, true, cloud), [...relay, ...cloud]);
  assert.deepEqual(mergedClients(relay, false, cloud), cloud, 'link offline: no show listed');
  assert.deepEqual(mergedClients(null, true, cloud), cloud, 'the relay has not said yet');
});
