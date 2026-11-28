// Consoles through the cloud: what the laptop forwards, and who the consoles see connected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES } from '@quina/protocol';
import { ALWAYS_FORWARDED, cloudConsoleIds, isLaptopOnlyCommand, mergedClients, shouldForward, stampCloudCommand } from '../../src/domain/consoles.ts';
import type { Command } from '@quina/protocol';

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
  const echoed = [...relay, { role: 'console' as const, clientId: 'cloud:Tauleta-3f2a' }];
  assert.deepEqual(mergedClients(echoed, true, cloud), [...relay, ...cloud], "the relay's cloud: echo of a cloud console: listed once");
});

test("D234 through the cloud: a console's command carries cloud:<its clientId>, never a from the browser set", () => {
  const hold = { v: 1, type: 'cmd', cmd: 'hold', reqId: 'r-1', on: true } as Command;
  assert.deepEqual(stampCloudCommand(hold, 'Tauleta-3f2a'), { ...hold, from: 'cloud:Tauleta-3f2a' });
  assert.equal(stampCloudCommand({ ...hold, from: 'cloud:Mobil-admin-1' }, 'Tauleta-3f2a').from, 'cloud:Tauleta-3f2a', 'posing as another console');
  for (const id of ['Tauleta 3', 'Tauleta:3', 'x'.repeat(65), '', null]) {
    const stamped = stampCloudCommand({ ...hold, from: 'show-1' }, id);
    assert.equal('from' in stamped, false, `no from for ${JSON.stringify(id)}`);
  }
  assert.equal('from' in hold, false, 'the checked command is left as it was');
});

test("the consoles' ids for the relay: each plain id once, as cloud:<id>, at most 64", () => {
  assert.deepEqual(cloudConsoleIds(['Tauleta-3f2a', 'Mobil_admin-x1', 'Tauleta-3f2a', 'Tauleta 3', null]), ['cloud:Tauleta-3f2a', 'cloud:Mobil_admin-x1']);
  assert.equal(cloudConsoleIds(Array.from({ length: 70 }, (_, i) => `t-${i}`)).length, 64);
  assert.deepEqual(cloudConsoleIds([]), []);
});

test("the Wii Remote's status stays on the laptop: never forwarded, never a link event, never public", async () => {
  const { checkLinkMessage } = await import('../../src/link-protocol.ts');
  const { projectEvent } = await import('../../src/domain/projection.ts');
  const { emptyPublicState } = await import('@quina/protocol');
  // The relay sends it to the laptop's paired consoles only; even with consoles in the cloud the link keeps it.
  assert.equal(shouldForward('remote.status', 0), false);
  assert.equal(shouldForward('remote.status', 3), false);
  const status = { v: 1, type: 'remote.status', connected: true, battery: 0.8, sinceMs: 1, clientId: 'Tauleta-3f2a' };
  // A link that sent it anyway is refused, so it can't reach the GameRoom's projection or its consoles.
  assert.equal(checkLinkMessage({ v: 1, type: 'link.event', event: status, sentAtMs: 1 }).ok, false);
  // And the public projection makes nothing of it.
  assert.deepEqual(projectEvent(emptyPublicState('26'), status as never, { toCloudMs: (ms) => ms }), []);
});

test('the test tools stay on the laptop: relay.mode is never forwarded, testReset and testJump are laptop-only', () => {
  assert.equal(shouldForward('relay.mode', 0), false);
  assert.equal(shouldForward('relay.mode', 3), false, 'not even with consoles listening through the cloud');
  assert.equal(isLaptopOnlyCommand({ v: 1, type: 'cmd', cmd: 'testReset', reqId: 'r-1' }), true);
  assert.equal(isLaptopOnlyCommand({ v: 1, type: 'cmd', cmd: 'testJump', reqId: 'r-2', round: 3, songs: 5 }), true);
  for (const cmd of ['next', 'hold', 'getState', 'testreset', 'test', 'roundIntro', 'resumeAt']) assert.equal(isLaptopOnlyCommand({ v: 1, type: 'cmd', cmd, reqId: 'r-1' }), false, cmd);
  for (const message of [null, undefined, 'testReset', 42, [], { cmd: 7 }]) assert.equal(isLaptopOnlyCommand(message), false, JSON.stringify(message));
});
