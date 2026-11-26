// The Wii Remote: report parsing, the deliberate shake, and the button mapping (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WII } from '../../../../console/config.ts';
import { buttonChanges, parseReport, REPORT } from '../../../../console/wii/report.ts';
import { ShakeDetector } from '../../../../console/wii/shake.ts';
import { WiiMapper, type WiiContext, type WiiOutput } from '../../../../console/wii/mapping.ts';

const idle: WiiContext = { holdMode: null, autoAdvance: true, paused: false, check: null };
/** A Check revealing its third song. */
const revealing: WiiContext = { ...idle, check: { back: { claimId: 'cl-5', step: 1 }, review: { claimId: 'cl-5' }, auto: true } };
/** A Check under review: no step back, no review, no reveals. */
const reviewing: WiiContext = { ...idle, check: { back: null, review: null, auto: false } };
const cmds = (outs: WiiOutput[]) => outs.map((o) => o.command);
const rest = { x: 0, y: 0, z: 1 };
const jolt = { x: 3.2, y: 0.4, z: 1 };

test('reports: buttons from the first two bytes, the accelerometer in g from 0x31 only', () => {
  const r = parseReport(REPORT.buttonsAccel, new Uint8Array([0x08, 0x0c, 128, 154, 128]), WII.accel);
  assert.deepEqual([...(r?.pressed ?? [])].sort(), ['a', 'b', 'up']);
  assert.deepEqual(r?.accel, { x: 0, y: 1, z: 0 });
  assert.equal(parseReport(REPORT.buttons, new Uint8Array([0, 0x80]), WII.accel)?.accel, null);
  assert.ok(parseReport(REPORT.buttons, new Uint8Array([0, 0x80]), WII.accel)?.pressed.has('home'));
  assert.equal(parseReport(0x20, new Uint8Array([0, 0]), WII.accel), null, 'a status report');
  assert.deepEqual(buttonChanges(new Set(['a', 'b']), new Set(['b', 'home'])), { down: ['home'], up: ['a'] });
});

test('the shake: three strong jolts inside the window, each one counted once', () => {
  const s = new ShakeDetector(WII.shake);
  // One long swing over the threshold is one jolt, however many samples it lasts.
  assert.equal(s.push(0, 3), false);
  assert.equal(s.push(10, 3.4), false);
  assert.equal(s.push(20, 1), false);
  assert.equal(s.push(200, 3), false);
  assert.equal(s.push(220, 1), false);
  assert.equal(s.push(400, 2.9), true, 'the third jolt');
  // Too slow: jolts 800 ms apart never make three within 1.5 s.
  const slow = new ShakeDetector(WII.shake);
  const fired = [0, 800, 1600, 2400].map((t) => [slow.push(t, 3), slow.push(t + 50, 1)][0]);
  assert.deepEqual(fired, [false, false, false, false]);
  // Dancing: lots of movement under the threshold.
  const dance = new ShakeDetector(WII.shake);
  assert.ok(Array.from({ length: 200 }, (_, i) => dance.push(i * 10, 1 + Math.abs(Math.sin(i / 3)) * 1.4)).every((f) => !f));
});

test('A is the default action; − and + toggle Parlem; HOME toggles auto with different rumbles; the D-pad plays effects', () => {
  const m = new WiiMapper(WII);
  // Resolved by the controller at the press (logic/default-action.ts; tests in default-action.test.ts).
  assert.deepEqual(m.press('a', 0, idle), [{ command: { cmd: 'default' }, rumble: 'tap' }]);
  assert.deepEqual(cmds(m.press('a', 0, { ...idle, holdMode: 'stay', paused: true })), [{ cmd: 'default' }], 'whatever the context');
  assert.deepEqual(cmds(m.press('minus', 0, idle)), [], 'decided on release');
  assert.deepEqual(cmds(m.release('minus', idle)), [{ cmd: 'hold', args: { on: true, duck: true } }]);
  m.press('plus', 0, idle);
  assert.deepEqual(cmds(m.release('plus', { ...idle, holdMode: 'talk' })), [{ cmd: 'hold', args: { on: false } }]);
  const off = m.press('home', 0, idle);
  assert.deepEqual(off, [{ command: { cmd: 'setGame', args: { autoAdvance: false } }, rumble: 'autoOff' }]);
  assert.equal(m.press('home', 0, { ...idle, autoAdvance: false })[0].rumble, 'autoOn');
  assert.deepEqual(cmds(m.press('up', 0, idle)), [{ cmd: 'sfx', args: { name: WII.dpad.up } }]);
  assert.equal(m.press('left', 0, idle)[0].rumble, 'tap', 'every action rumbles');
});

test('B held is Aguanta; releasing it goes back to normal', () => {
  const m = new WiiMapper(WII);
  assert.deepEqual(cmds(m.press('b', 0, idle)), [{ cmd: 'hold', args: { on: true, duck: false } }]);
  assert.deepEqual(cmds(m.motion(100, rest)), []);
  assert.deepEqual(cmds(m.release('b', idle)), [{ cmd: 'hold', args: { on: false } }]);
});

test('B held plus the shake switches to Suspens once; releasing B lands it', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  const samples = [jolt, rest, jolt, rest, jolt, rest, jolt];
  const outs = samples.flatMap((a, i) => m.motion(100 + i * 120, a));
  assert.deepEqual(outs, [{ command: { cmd: 'suspense', args: { on: true } }, rumble: 'suspense' }], 'once, with its own rumble');
  assert.deepEqual(cmds(m.release('b', idle)), [{ cmd: 'suspense', args: { on: false } }]);
  // Shaking without B does nothing.
  assert.deepEqual(samples.flatMap((a, i) => m.motion(2000 + i * 120, a)), []);
});

test('1 or 2 held for 1.5 s is Enrere, once per press, with a long rumble; a short press does nothing', () => {
  const m = new WiiMapper(WII);
  m.press('one', 0, idle);
  assert.deepEqual(m.tick(1000, idle), []);
  assert.deepEqual(m.tick(1500, idle), [{ command: { cmd: 'back' }, rumble: 'back' }]);
  assert.deepEqual(m.tick(2500, idle), [], 'still held: only once');
  m.release('one', idle);
  m.press('two', 3000, idle);
  assert.deepEqual(m.release('two', idle), []);
  assert.deepEqual(m.tick(5000, idle), []);
});

test('in a Check, 1 or 2 pressed once takes the last revealed mark off (D127, D134); held, it is still Enrere', () => {
  const m = new WiiMapper(WII);
  m.press('two', 0, revealing);
  assert.deepEqual(m.tick(200, revealing), []);
  assert.deepEqual(m.release('two', revealing), [{ command: { cmd: 'checkBack', args: { claimId: 'cl-5', step: 1 } }, rumble: 'tap' }]);
  m.press('one', 1000, reviewing);
  assert.deepEqual(m.release('one', reviewing), [], 'not under review, nor after the cue');
  m.press('one', 2000, revealing);
  assert.deepEqual(cmds(m.tick(2000 + WII.backHoldMs, revealing)), [{ cmd: 'back' }], 'the hold undoes a landing, as today (U104)');
  assert.deepEqual(m.release('one', revealing), [], 'and no step back on top');
});

test('in a Check, A held reveals in a row until it is let go; outside a Check a hold does nothing more', () => {
  const m = new WiiMapper(WII);
  assert.deepEqual(cmds(m.press('a', 0, revealing)), [{ cmd: 'default' }], 'the press reveals one at once');
  assert.deepEqual(m.tick(WII.aHoldMs - 10, revealing), []);
  assert.deepEqual(m.tick(WII.aHoldMs, revealing), [{ command: { cmd: 'checkAuto', args: { on: true } }, rumble: 'autoOn' }]);
  assert.deepEqual(m.tick(WII.aHoldMs + 2000, revealing), [], 'once');
  assert.deepEqual(m.release('a', revealing), [{ command: { cmd: 'checkAuto', args: { on: false } }, rumble: 'autoOff' }]);
  m.press('a', 5000, idle);
  assert.deepEqual(m.tick(5000 + WII.aHoldMs, idle), []);
  assert.deepEqual(m.tick(5000 + WII.aHoldMs + 100, revealing), [], 'a Check coming on meanwhile: still nothing');
  assert.deepEqual(m.release('a', revealing), []);
  m.press('a', 9000, reviewing);
  assert.deepEqual(m.tick(9000 + WII.aHoldMs, reviewing), [], 'under review A does nothing (D135)');
});

test('in a Check, − or + held is «Revisió manual» (D128); under review it is Pausa again (D135)', () => {
  const m = new WiiMapper(WII);
  m.press('minus', 0, revealing);
  assert.deepEqual(m.tick(WII.pauseHoldMs, revealing), [{ command: { cmd: 'checkReview', args: { claimId: 'cl-5' } }, rumble: 'pause' }]);
  assert.deepEqual(m.release('minus', revealing), []);
  m.press('plus', 2000, reviewing);
  assert.deepEqual(cmds(m.tick(2000 + WII.pauseHoldMs, reviewing)), [{ cmd: 'pause', args: { on: true } }]);
});

test('− or + held is Pausa (once, its own rumble, nothing on release); a tap in Pausa leaves it', () => {
  const m = new WiiMapper(WII);
  m.press('minus', 0, idle);
  assert.deepEqual(m.tick(WII.pauseHoldMs - 10, idle), []);
  assert.deepEqual(m.tick(WII.pauseHoldMs, idle), [{ command: { cmd: 'pause', args: { on: true } }, rumble: 'pause' }]);
  assert.deepEqual(m.tick(WII.pauseHoldMs + 500, idle), [], 'only once');
  assert.deepEqual(m.release('minus', idle), [], 'the hold already acted');
  m.press('plus', 5000, { ...idle, paused: true });
  assert.deepEqual(cmds(m.release('plus', { ...idle, paused: true })), [{ cmd: 'pause', args: { on: false } }]);
});

test("other consoles' remotes: any connected host counts; a lost one is remembered until one connects", async () => {
  const { RemoteHosts, readRemoteStatus, remoteStatusMessage } = await import('../../../../../packages/ui/client/remote-status.ts');
  const hosts = new RemoteHosts();
  assert.deepEqual(hosts.summary(), { connected: false, lost: false, battery: null, drops: 0 });
  const msg = { ...remoteStatusMessage({ connected: true, battery: 0.8, sinceMs: 1 }), clientId: 'laptop' };
  const read = readRemoteStatus(msg);
  assert.ok(read);
  assert.equal(hosts.apply(read.clientId, read), true);
  assert.equal(hosts.apply(read.clientId, read), false, 'the same report again: nothing changes');
  assert.deepEqual(hosts.summary(), { connected: true, lost: false, battery: 0.8, drops: 0 });
  hosts.apply('laptop', { connected: false, battery: null, sinceMs: 2 });
  assert.deepEqual(hosts.summary(), { connected: false, lost: true, battery: null, drops: 0 }, 'a remote went away: red');
  hosts.apply('laptop-2', { connected: true, battery: null, sinceMs: 3 });
  assert.deepEqual(hosts.summary(), { connected: true, lost: false, battery: null, drops: 0 });
  assert.equal(readRemoteStatus({ ...msg, battery: 7 })?.battery, null, 'junk battery reads as unknown');
  assert.equal(readRemoteStatus({ ...msg, type: 'remote.other' }), null);
});

test('the status report: the battery byte as 0..1', async () => {
  const { parseStatus } = await import('../../../../console/wii/report.ts');
  assert.deepEqual(parseStatus(new Uint8Array([0, 0, 0x10, 0, 0, 0x64])), { battery: 0.5 });
  assert.deepEqual(parseStatus(new Uint8Array([0, 0, 0, 0, 0, 0xff])), { battery: 1 });
  assert.equal(parseStatus(new Uint8Array([0, 0])), null);
});
