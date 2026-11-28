// The relay's gate for commands (relay/gate.ts) and its test mode (`--test`, rehearsal test runs only): which socket's
// commands reach the show page, the test tools only in test mode and never from the cloud link, and `relay.mode` on every
// hello. The rules as a pure function, then one spawned relay each way (a few hundred ms each: Vite in middleware mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMAND_NAMES, PROTOCOL_VERSION, ROLES, TEST_COMMANDS, isEvent, isRelayMode, isTestCommand, type Role } from '@quina/protocol';
import { COMMANDERS, relayAcceptsCommand, relayModeMessage } from '../relay/gate.ts';
import { cmd, peer, startRelay, type Peer } from './support/relay.ts';

const ALL_ROLES: (Role | 'unknown')[] = [...ROLES, 'unknown'];

test('the gate: commands come only from the consoles and the cloud link; getJournal only from the link', () => {
  for (const testMode of [false, true]) {
    for (const role of ALL_ROLES) {
      for (const cmd of COMMAND_NAMES.filter((c) => !isTestCommand(c))) {
        const expected = role !== 'unknown' && COMMANDERS.includes(role) && (cmd !== 'getJournal' || role === 'cloud');
        assert.equal(relayAcceptsCommand(cmd, role, testMode), expected, `${cmd} from ${role}${testMode ? ' (test mode)' : ''}`);
      }
    }
  }
  assert.deepEqual([...COMMANDERS].sort(), ['admin', 'cloud', 'tablet']);
  for (const role of ['show', 'drum', 'unknown'] as const) assert.equal(relayAcceptsCommand('next', role, true), false, `never from ${role}`);
  assert.equal(relayAcceptsCommand(undefined, 'tablet', false), true, 'an unknown or missing cmd goes on: the engine refuses it');
});

test('the gate: the test tools only in test mode, from a LAN console, never from the cloud link', () => {
  for (const cmd of TEST_COMMANDS) {
    for (const role of ALL_ROLES) {
      assert.equal(relayAcceptsCommand(cmd, role, false), false, `${cmd} from ${role} without --test`);
      assert.equal(relayAcceptsCommand(cmd, role, true), role === 'tablet' || role === 'admin', `${cmd} from ${role} with --test`);
    }
  }
});

test('relay.mode: a relay event every remote accepts, true only in test mode', () => {
  assert.deepEqual(relayModeMessage(true), { v: PROTOCOL_VERSION, type: 'relay.mode', test: true });
  assert.deepEqual(relayModeMessage(false), { v: PROTOCOL_VERSION, type: 'relay.mode', test: false });
  assert.ok(isEvent(relayModeMessage(false)), 'isEvent lets it through, like the other relay messages');
  assert.equal(isEvent({ v: 0, type: 'relay.mode', test: true }), false, 'another protocol version');
  assert.ok(isRelayMode(relayModeMessage(true)) && isRelayMode(relayModeMessage(false)));
  for (const bad of [{ v: PROTOCOL_VERSION, type: 'relay.mode' }, { v: PROTOCOL_VERSION, type: 'relay.mode', test: 'yes' }, { v: 0, type: 'relay.mode', test: true }, { v: PROTOCOL_VERSION, type: 'relay.plan', test: true }, null, 'relay.mode']) {
    assert.equal(isRelayMode(bad), false, JSON.stringify(bad));
  }
});

// ---- one spawned relay each way --------------------------------------------------------------------------------------
for (const testMode of [true, false]) {
  test(`a spawned relay ${testMode ? 'with' : 'without'} --test: relay.mode on every hello, and the test tools ${testMode ? 'from a LAN console only' : 'never'}`, async () => {
    const relay = await startRelay(testMode ? ['--test'] : []);
    const peers: Peer[] = [];
    try {
      const show = await peer(relay.ws, 'show', 'show-1');
      const tablet = await peer(relay.ws, 'tablet', 'tablet-1');
      const cloud = await peer(relay.ws, 'cloud', 'cloud-link-1');
      const drum = await peer(relay.ws, 'drum', 'drum-1');
      peers.push(show, tablet, cloud, drum);
      for (const p of peers) {
        const mode = await p.hears((m) => m.type === 'relay.mode', 'relay.mode');
        assert.deepEqual(mode, { v: PROTOCOL_VERSION, type: 'relay.mode', test: testMode });
      }
      // Each socket's commands, then a getState to know they have all been through (the relay forwards in order).
      tablet.send(cmd('testJump', 'tablet-jump', { round: 3 }));
      tablet.send(cmd('testReset', 'tablet-reset'));
      tablet.send(cmd('getState', 'tablet-done'));
      cloud.send(cmd('testJump', 'cloud-jump', { round: 3 }));
      cloud.send(cmd('testReset', 'cloud-reset'));
      cloud.send(cmd('getState', 'cloud-done'));
      await show.hears((m) => m.reqId === 'tablet-done', "the tablet's getState");
      await show.hears((m) => m.reqId === 'cloud-done', "the cloud's getState");
      const reached = show.heard.filter((m) => m.type === 'cmd').map((m) => m.reqId);
      assert.deepEqual(reached.filter((id) => id === 'tablet-jump' || id === 'tablet-reset'), testMode ? ['tablet-jump', 'tablet-reset'] : [], "a LAN console's test tools");
      assert.deepEqual(reached.filter((id) => id === 'cloud-jump' || id === 'cloud-reset'), [], 'never from the cloud link');
      const jumped = show.heard.find((m) => m.reqId === 'tablet-jump');
      if (testMode) assert.equal(jumped?.from, 'tablet-1', 'stamped like any command');
      // Its start-up output has long arrived by now (it is printed as the relay starts listening).
      assert.equal(relay.output().includes('TEST MODE (--test)'), testMode, 'the banner only in test mode');
    } finally {
      for (const p of peers) p.close();
      await relay.stop();
    }
  });
}
