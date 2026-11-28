// The relay's gate for commands (relay/gate.ts) and its test mode (`--test`, rehearsal test runs only): which socket's
// commands reach the show page, the test tools only in test mode and never from the cloud link, and `relay.mode` on every
// hello. The rules as a pure function, then one spawned relay each way (a few hundred ms each: Vite in middleware mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { COMMAND_NAMES, PROTOCOL_VERSION, ROLES, TEST_COMMANDS, isEvent, isRelayMode, isTestCommand, type Role } from '@quina/protocol';
import { COMMANDERS, relayAcceptsCommand, relayModeMessage } from '../relay/gate.ts';
import { SHOW } from '../relay/repertoire.ts';

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
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

interface Relay {
  ws: string;
  output: () => string;
  stop: () => Promise<void>;
}

/** A relay of its own on a free port: a test token (nothing written to data/cache) and a scratch cloud link folder. */
async function startRelay(flags: string[]): Promise<Relay> {
  const port = await freePort();
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-relay-gate-'));
  const child: ChildProcess = spawn(process.execPath, ['relay/server.ts', '--port', String(port), '--token', 'GATETESTTOKEN2345', '--repertoire', 'default', ...flags], {
    cwd: SHOW, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, QUINA_LINK_DIR: linkDir },
  });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    fs.rmSync(linkDir, { recursive: true, force: true });
  };
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/repertoire`)).ok) return { ws: `ws://127.0.0.1:${port}/ws`, output: () => output, stop };
    } catch {
      // not up yet
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await stop();
  throw new Error(`the relay did not start:\n${output}`);
}

interface Peer {
  heard: Record<string, unknown>[];
  send: (message: Record<string, unknown>) => void;
  /** Wait until it has heard a message that passes `predicate`. */
  hears: (predicate: (m: Record<string, unknown>) => boolean, what: string) => Promise<Record<string, unknown>>;
  close: () => void;
}

/** A socket on this laptop (no token needed) that says hello as `role`. */
function peer(url: string, role: Role, clientId: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const heard: Record<string, unknown>[] = [];
    const waiters: (() => void)[] = [];
    ws.on('message', (data) => {
      heard.push(JSON.parse(String(data)));
      for (const w of waiters.splice(0)) w();
    });
    ws.on('error', reject);
    ws.on('open', () => {
      ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role, clientId }));
      const hears: Peer['hears'] = (predicate, what) => new Promise((done, fail) => {
        const timer = setTimeout(() => fail(new Error(`${clientId} never heard ${what}; heard ${heard.map((m) => m.type).join(', ')}`)), 5000);
        const check = () => {
          const found = heard.find(predicate);
          if (found) {
            clearTimeout(timer);
            done(found);
          } else waiters.push(check);
        };
        check();
      });
      resolve({ heard, send: (m) => ws.send(JSON.stringify(m)), hears, close: () => ws.close() });
    });
  });
}

const cmd = (name: string, reqId: string, fields: Record<string, unknown> = {}) => ({ v: PROTOCOL_VERSION, type: 'cmd', cmd: name, reqId, ...fields });

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
