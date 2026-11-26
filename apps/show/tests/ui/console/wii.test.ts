// The Wii Remote: report parsing, the deliberate shake, and the button mapping (pure), with Suspens from B + A, from B
// alone with manual advance, and from the shake (D144–D148).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WII } from '../../../../console/config.ts';
import { buttonChanges, parseReport, REPORT } from '../../../../console/wii/report.ts';
import { ShakeDetector } from '../../../../console/wii/shake.ts';
import { WiiMapper, type WiiContext, type WiiOutput } from '../../../../console/wii/mapping.ts';

const idle: WiiContext = { holdMode: null, autoAdvance: true, paused: false, check: null, canSuspense: true, canSuspenseInSpin: true, nextIsDefault: true, suspenseOpen: false, shake: true };
/** A Spin running: Següent is off and a plain Suspens can't start, but one asked for turns the Spin into it (D177). */
const spinning: WiiContext = { ...idle, canSuspense: false, nextIsDefault: false };
/** In Aguanta (B held), and with a Suspens open. */
const staying: WiiContext = { ...idle, holdMode: 'stay' };
const open: WiiContext = { ...idle, suspenseOpen: true, canSuspense: false };
const manual: WiiContext = { ...idle, autoAdvance: false };
const manualOpen: WiiContext = { ...open, autoAdvance: false };
const { windowMs, pulses } = WII.suspenseWindow;
const beat = windowMs / pulses;
const rumbles = (outs: WiiOutput[]) => outs.map((o) => o.rumble);
/** A Check revealing its third song. */
const revealing: WiiContext = { ...idle, nextIsDefault: false, check: { back: { claimId: 'cl-5', step: 1 }, review: { claimId: 'cl-5' }, auto: true } };
/** A Check under review: no step back, no review, no reveals. */
const reviewing: WiiContext = { ...idle, nextIsDefault: false, check: { back: null, review: null, auto: false } };
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
  assert.equal(s.push(0, 3), 'jolt');
  assert.equal(s.push(10, 3.4), 'none');
  assert.equal(s.push(20, 1), 'none');
  assert.equal(s.push(200, 3), 'jolt');
  assert.equal(s.push(220, 1), 'none');
  assert.equal(s.push(400, 2.9), 'shake', 'the third jolt');
  // Too slow: jolts 800 ms apart never make three within 1.5 s.
  const slow = new ShakeDetector(WII.shake);
  const fired = [0, 800, 1600, 2400].map((t) => [slow.push(t, 3), slow.push(t + 50, 1)][0]);
  assert.deepEqual(fired, ['jolt', 'jolt', 'jolt', 'jolt']);
  // Dancing: lots of movement under the threshold.
  const dance = new ShakeDetector(WII.shake);
  assert.ok(Array.from({ length: 200 }, (_, i) => dance.push(i * 10, 1 + Math.abs(Math.sin(i / 3)) * 1.4)).every((f) => f === 'none'));
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
  assert.deepEqual(cmds(m.motion(100, rest, idle)), []);
  assert.deepEqual(cmds(m.release('b', idle)), [{ cmd: 'hold', args: { on: false } }]);
});

test('B held plus the shake: each jolt vibrates, the third opens Suspens at once; releasing B lands it', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  const samples = [jolt, rest, jolt, rest, jolt, rest, jolt];
  const outs = samples.flatMap((a, i) => m.motion(100 + i * 120, a, staying));
  assert.deepEqual(outs, [
    { command: null, rumble: 'jolt' },
    { command: null, rumble: 'jolt' },
    { command: { cmd: 'suspense', args: { on: true } }, rumble: 'suspenseOn' },
  ], 'one buzz per jolt, then Suspens with its lasting vibration, once');
  assert.deepEqual(m.tick(900, open), [], 'on: nothing more while it stays open');
  assert.deepEqual(m.release('b', open), [{ command: { cmd: 'suspense', args: { on: false } }, rumble: 'tap' }]);
  // Shaking without B does nothing.
  assert.deepEqual(samples.flatMap((a, i) => m.motion(2000 + i * 120, a, idle)), []);
});

test('the shake switched off (D148): shaking with B held does nothing, B stays Aguanta', () => {
  const m = new WiiMapper(WII);
  const off = { ...staying, shake: false };
  m.press('b', 0, idle);
  assert.deepEqual([jolt, rest, jolt, rest, jolt].flatMap((a, i) => m.motion(100 + i * 120, a, off)), []);
  assert.deepEqual(cmds(m.release('b', off)), [{ cmd: 'hold', args: { on: false } }]);
});

test('B then A held: Suspens at once, silently; its window beats; letting go of A inside it backs out to Aguanta (D144, D147)', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  assert.deepEqual(m.press('a', 1000, staying), [{ command: { cmd: 'suspense', args: { on: true } }, rumble: null }], 'not the default action');
  assert.deepEqual(m.tick(1000 + beat - 10, open), []);
  assert.deepEqual(m.tick(1000 + beat, open), [{ command: null, rumble: 'suspenseStep' }]);
  assert.deepEqual(m.tick(1000 + beat + 50, open), [], 'each beat once');
  assert.deepEqual(rumbles(m.tick(1000 + 2 * beat, open)), pulses > 2 ? ['suspenseStep'] : ['suspenseOn']);
  assert.deepEqual(m.release('a', open), [{ command: { cmd: 'suspense', args: { on: false, cancel: true } }, rumble: 'suspenseCancel' }]);
  assert.deepEqual(m.tick(1000 + windowMs + 100, staying), [], 'cancelled: no last beat');
  assert.deepEqual(cmds(m.release('b', staying)), [{ cmd: 'hold', args: { on: false } }], 'Aguanta ends with B');
});

test('B then A held past the window: it can no longer be undone; A let go does nothing, B let go lands it', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  m.press('a', 200, staying);
  const all = Array.from({ length: 40 }, (_, i) => m.tick(200 + i * 50, open)).flat();
  assert.deepEqual(rumbles(all), [...Array.from({ length: pulses - 1 }, () => 'suspenseStep'), 'suspenseOn'], `${pulses} evenly spaced beats, the last one final`);
  assert.deepEqual(m.release('a', open), [], 'too late to cancel');
  assert.deepEqual(m.release('b', open), [{ command: { cmd: 'suspense', args: { on: false } }, rumble: 'tap' }]);
  assert.deepEqual(m.release('a', idle), [], 'and A never fires the default afterwards');
});

test('B let go while A\'s window runs: the Suspens backs out and Aguanta ends', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  m.press('a', 100, staying);
  assert.deepEqual(m.release('b', open), [
    { command: { cmd: 'suspense', args: { on: false, cancel: true } }, rumble: 'suspenseCancel' },
    { command: { cmd: 'hold', args: { on: false } }, rumble: null },
  ]);
  assert.deepEqual(m.release('a', idle), [], 'A belongs to that Suspens: no default on release');
  assert.deepEqual(m.tick(100 + windowMs, idle), []);
});

test('A with B held, where a Suspens can\'t start (a Spin, a Check): nothing, not the default action', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  assert.deepEqual(m.press('a', 100, { ...staying, canSuspense: false }), []);
  assert.deepEqual(m.release('a', staying), []);
});

test('A (Següent), then B with A still held: the Spin becomes a Suspens, its window from both down; past it, B lands it (D176, D177)', () => {
  const m = new WiiMapper(WII);
  assert.deepEqual(cmds(m.press('a', 0, idle)), [{ cmd: 'default' }], 'Següent at once: no delay on A');
  assert.deepEqual(m.press('b', 300, spinning), [{ command: { cmd: 'suspense', args: { on: true } }, rumble: null }], 'not Aguanta, which would cancel the Spin');
  assert.deepEqual(m.tick(300 + beat - 10, open), [], 'the window counts from B, not from A');
  const all = Array.from({ length: 40 }, (_, i) => m.tick(300 + beat + i * 50, open)).flat();
  assert.deepEqual(rumbles(all), [...Array.from({ length: pulses - 1 }, () => 'suspenseStep'), 'suspenseOn']);
  assert.deepEqual(m.release('a', open), [], 'too late to cancel');
  assert.deepEqual(m.release('b', open), [{ command: { cmd: 'suspense', args: { on: false } }, rumble: 'tap' }]);
});

test('A then B: A let go inside the window cancels the Suspens, and B, still held, is Aguanta until it is let go', () => {
  const m = new WiiMapper(WII);
  m.press('a', 0, idle);
  m.press('b', 100, spinning);
  assert.deepEqual(rumbles(m.tick(100 + beat, open)), ['suspenseStep']);
  assert.deepEqual(m.release('a', open), [
    { command: { cmd: 'suspense', args: { on: false, cancel: true } }, rumble: 'suspenseCancel' },
    { command: { cmd: 'hold', args: { on: true, duck: false } }, rumble: null },
  ]);
  assert.deepEqual(m.tick(100 + windowMs + 100, staying), [], 'cancelled: no last beat');
  assert.deepEqual(cmds(m.release('b', staying)), [{ cmd: 'hold', args: { on: false } }]);
});

test('A then B: B let go inside the window cancels it; nothing else to end, and A sends nothing when let go', () => {
  const m = new WiiMapper(WII);
  m.press('a', 0, idle);
  m.press('b', 100, spinning);
  assert.deepEqual(m.release('b', open), [{ command: { cmd: 'suspense', args: { on: false, cancel: true } }, rumble: 'suspenseCancel' }]);
  assert.deepEqual(m.release('a', idle), []);
});

test('A then B, and the Spin lands in its last instant: the engine puts the new song in Aguanta, which ends with B', () => {
  const m = new WiiMapper(WII);
  m.press('a', 0, idle);
  m.press('b', 100, spinning);
  const all = Array.from({ length: 40 }, (_, i) => m.tick(100 + i * 50, staying)).flat();
  assert.deepEqual(rumbles(all).at(-1), 'stop', 'no Suspens ever opened: the vibration stops');
  assert.deepEqual(cmds(m.release('b', staying)), [{ cmd: 'hold', args: { on: false } }]);
});

test('A pressed and let go, then B: a plain Aguanta, which cancels the Spin as ever; and an A that wasn\'t Següent changes nothing', () => {
  const m = new WiiMapper(WII);
  m.press('a', 0, idle);
  m.release('a', idle);
  assert.deepEqual(cmds(m.press('b', 300, spinning)), [{ cmd: 'hold', args: { on: true, duck: false } }]);
  m.release('b', staying);
  const c = new WiiMapper(WII);
  c.press('a', 0, revealing);
  assert.deepEqual(cmds(c.press('b', 100, revealing)), [{ cmd: 'hold', args: { on: true, duck: false } }], 'in a Check A reveals: B is Aguanta');
});

test('with «Avanç manual», B alone enters Suspens; let go before the last beat it cancels, after it lands (D145, D148)', () => {
  const m = new WiiMapper(WII);
  assert.deepEqual(m.press('b', 0, manual), [{ command: { cmd: 'suspense', args: { on: true } }, rumble: null }]);
  assert.deepEqual(rumbles(m.tick(beat, manualOpen)), ['suspenseStep']);
  assert.deepEqual(m.press('a', beat + 10, manualOpen), [], 'A does nothing meanwhile');
  assert.deepEqual(m.release('b', manualOpen), [{ command: { cmd: 'suspense', args: { on: false, cancel: true } }, rumble: 'suspenseCancel' }], 'back to playing, no Aguanta to end');
  m.release('a', manual);

  m.press('b', 5000, manual);
  const all = Array.from({ length: 40 }, (_, i) => m.tick(5000 + i * 50, manualOpen)).flat();
  assert.equal(all.at(-1)?.rumble, 'suspenseOn');
  assert.deepEqual(m.release('b', manualOpen), [{ command: { cmd: 'suspense', args: { on: false } }, rumble: 'tap' }]);
  // Where a Suspens can't start (a Celebration), B is Aguanta as ever.
  assert.deepEqual(cmds(m.press('b', 9000, { ...manual, canSuspense: false })), [{ cmd: 'hold', args: { on: true, duck: false } }]);
});

test('a Suspens that ends by itself while B is held stops the gentle vibration, and B let go sends nothing', () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, manual);
  Array.from({ length: 40 }, (_, i) => m.tick(i * 50, manualOpen));
  assert.deepEqual(m.tick(25_000, manual), [{ command: null, rumble: 'stop' }], 'its auto-release');
  assert.deepEqual(m.tick(25_100, manual), [], 'once');
  assert.deepEqual(m.release('b', manual), []);
  // From Aguanta: once it has landed, nothing to release either; Aguanta still on (it never opened): let it go.
  m.press('b', 30_000, idle);
  m.press('a', 30_100, staying);
  assert.deepEqual(m.tick(30_100 + windowMs, staying), [{ command: null, rumble: 'stop' }], 'the engine never opened it');
  assert.deepEqual(cmds(m.release('b', staying)), [{ cmd: 'hold', args: { on: false } }]);
});

test("a shake's Suspens stays on until the snapshot has shown it open (the state lags a moment)", () => {
  const m = new WiiMapper(WII);
  m.press('b', 0, idle);
  [jolt, rest, jolt, rest, jolt].forEach((a, i) => m.motion(100 + i * 120, a, staying));
  assert.deepEqual(m.tick(600, staying), [], 'not open yet: not "ended"');
  assert.deepEqual(m.tick(700, open), []);
  assert.deepEqual(m.tick(800, idle), [{ command: null, rumble: 'stop' }], 'shown open, then closed: it ended');
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

test("the remote's guide (Comandament dialog, printed cheat sheet) has B's Suspens rows, with the window from the config", async () => {
  const { consoleWiiLegend } = await import('../../../../console/wii/guide.ts');
  const items = consoleWiiLegend();
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'one row per id');
  assert.deepEqual(items.filter((i) => i.group === 'b').map((i) => i.id), ['b', 'bA', 'shake', 'bManual']);
  const bA = items.find((i) => i.id === 'bA');
  assert.equal(bA?.key, 'B + A');
  assert.match(bA?.note ?? '', /vibra 3 cops \(~1,5 s\).*abans del tercer/);
  assert.match(bA?.note ?? '', /A i, sense deixar-la, B: el gir que comença es fa Suspens/, 'A then B (D176)');
  assert.equal(items.find((i) => i.id === 'shake')?.shake, true);
});
