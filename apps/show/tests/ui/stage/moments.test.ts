// Animation moments: named as in ANIMATIONS.md, timed by the show's clock, never replayed on a late join.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowOf, type FlowState } from '../../../../../packages/ui/flow.ts';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { stageView } from '../../../../stage/view.ts';
import { ANIM_NAMES, diffMoments, momentsOf, type AnimDetail, type MomentInputs, type Moments } from '../../../../stage/model/moments.ts';

const NOW = 1_800_000_000_000;
const inputs = (nowMs: number, extra: Partial<MomentInputs> = {}): MomentInputs => ({
  nowMs,
  heat: null,
  linkLost: false,
  checkMarkAt: 'end',
  prizeRotationMs: 8000,
  ...extra,
});
const viewOf = (state: FlowState, notes = { landed: [], spin: null }) => stageView(state, flowOf(state), SAMPLE_PLAN, null, notes);
const names = (a: AnimDetail[]) => a.map((x) => x.name);

test('the hook names are exactly the ANIMATIONS.md projector hooks', () => {
  assert.deepEqual([...ANIM_NAMES].sort(), [
    'celebrate', 'check-enter', 'check-result', 'check-step', 'credits', 'heat', 'idle', 'interval-rotate', 'landing', 'link-lost', 'pause', 'scene-enter', 'shuffle', 'spin', 'suspense',
  ]);
});

test('mounting only enters the scene: no landing or step is replayed', () => {
  const check = FIXTURES.checkValid(NOW).state;
  const out = diffMoments(null, momentsOf(viewOf(check), inputs(NOW)));
  assert.deepEqual(names(out), ['scene-enter', 'check-enter']);
  const play = FIXTURES.play(NOW).state;
  assert.deepEqual(names(diffMoments(null, momentsOf(viewOf(play), inputs(NOW)))), ['scene-enter']);
});

test('the first snapshot after connecting only enters its scene', () => {
  const waiting = momentsOf(stageView(null, flowOf(null), SAMPLE_PLAN, null), inputs(NOW));
  assert.deepEqual(names(diffMoments(null, waiting)), ['scene-enter', 'idle']);
  const play = momentsOf(viewOf(FIXTURES.play(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(waiting, play), [{ name: 'scene-enter', scene: 'play' }], 'no landing replayed');
  const check = momentsOf(viewOf(FIXTURES.checkValid(NOW).state), inputs(NOW));
  assert.deepEqual(names(diffMoments(waiting, check)), ['scene-enter', 'check-enter'], 'no past steps replayed');
  const before = momentsOf(viewOf(FIXTURES.before(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(waiting, before), [], 'the same scene is not entered twice');
});

test('a landing fires at its landing time, not when the message arrives', () => {
  const state = FIXTURES.play(NOW).state;
  const landed = { landed: [{ songId: 74, position: 99, atMs: NOW + 1000 }], spin: null };
  const before = momentsOf(viewOf(state), inputs(NOW));
  const early = momentsOf(viewOf(state, landed), inputs(NOW + 500));
  assert.deepEqual(diffMoments(before, early), []);
  const at = momentsOf(viewOf(state, landed), inputs(NOW + 1000));
  assert.deepEqual(diffMoments(early, at), [{ name: 'landing', songId: 74 }]);
  assert.deepEqual(diffMoments(at, at), []);
});

test('Back (an older song becomes the newest) is not a landing', () => {
  const state = FIXTURES.play(NOW).state;
  const landed = { landed: [{ songId: 74, position: 99, atMs: NOW }], spin: null };
  const withIt = momentsOf(viewOf(state, landed), inputs(NOW));
  const undone = momentsOf(viewOf(state), inputs(NOW + 10));
  assert.deepEqual(diffMoments(withIt, undone), []);
});

test('spin starts at its start time; suspense when it opens', () => {
  const state = FIXTURES.play(NOW).state;
  const transition = { id: 'tr', recipe: 'R7' as const, phase: 'late' as const, to: 74, landAtMs: NOW + 7000 };
  const spinning: FlowState = { ...state, status: 'transition', transition };
  const notes = { landed: [], spin: { id: 'tr', spinStartAtMs: NOW + 200, landAtMs: NOW + 7000, autoReleaseAtMs: null } };
  const idle = momentsOf(viewOf(state), inputs(NOW));
  const waiting = momentsOf(viewOf(spinning, notes), inputs(NOW + 100));
  assert.deepEqual(diffMoments(idle, waiting), []);
  const going = momentsOf(viewOf(spinning, notes), inputs(NOW + 200));
  assert.deepEqual(diffMoments(waiting, going), [{ name: 'spin' }]);
  const suspense = FIXTURES.suspense(NOW).state;
  assert.deepEqual(diffMoments(idle, momentsOf(viewOf(suspense), inputs(NOW))), [{ name: 'suspense' }]);
});

test('check steps: playing then marked, each at its time, and the result at the end', () => {
  const state = FIXTURES.check(NOW).state; // steps at +600, +3600, +6600, +9600 (2.5 s each); end +12600
  const at = (ms: number) => momentsOf(viewOf(state), inputs(NOW + ms));
  const entered = at(0);
  assert.deepEqual(diffMoments(entered, at(600)), [{ name: 'check-step', index: 0, songId: 2, state: 'playing' }]);
  assert.deepEqual(diffMoments(at(600), at(3100)), [{ name: 'check-step', index: 0, songId: 2, state: 'landed' }]);
  assert.deepEqual(diffMoments(at(9600), at(12100)), [{ name: 'check-step', index: 3, songId: 20, state: 'missed' }]);
  assert.deepEqual(diffMoments(at(12599), at(12600)), [{ name: 'check-result', result: 'incomplete' }]);
});

test('scene changes: check → celebration → interval', () => {
  const check = momentsOf(viewOf(FIXTURES.checkValid(NOW).state), inputs(NOW));
  const celebration = momentsOf(viewOf(FIXTURES.celebration(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(check, celebration), [
    { name: 'scene-enter', scene: 'celebration' },
    { name: 'celebrate', kind: 'line', cardIds: [123] },
  ]);
  const interval = momentsOf(viewOf(FIXTURES.interval(NOW).state), inputs(NOW));
  assert.deepEqual(names(diffMoments(celebration, interval)), ['scene-enter', 'idle']);
  const after = momentsOf(viewOf(FIXTURES.after(NOW).state), inputs(NOW));
  assert.deepEqual(names(diffMoments(interval, after)), ['scene-enter', 'idle', 'credits']);
});

test('the next card\'s Check enters again without leaving the scene', () => {
  const { state } = FIXTURES.check(NOW);
  const first = momentsOf(viewOf(state), inputs(NOW));
  const other: FlowState = { ...state, check: state.check ? { ...state.check, cardId: 204, startAtMs: NOW + 20000 } : null };
  assert.deepEqual(diffMoments(first, momentsOf(viewOf(other), inputs(NOW))), [{ name: 'check-enter', cardId: 204, kind: 'line' }]);
});

test('shuffle phases fire as the clock crosses them', () => {
  const state = FIXTURES.shuffle(NOW).state; // window +500 … +9500
  const at = (ms: number) => momentsOf(viewOf(state), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(0), at(499)), []);
  assert.deepEqual(diffMoments(at(499), at(500)), [{ name: 'shuffle', phase: 'appear' }]);
  const phases = [500, 1500, 2500, 3500, 5000, 8500, 9500].map(at);
  const fired = phases.slice(1).flatMap((m, i) => diffMoments(phases[i], m));
  assert.deepEqual(fired.map((a) => (a.name === 'shuffle' ? a.phase : a.name)), ['jiggle', 'fly', 'settle', 'done']);
});

test('heat fires when a new sample starts; pause and link-lost when they change', () => {
  const state = FIXTURES.play(NOW).state;
  const v = viewOf(state);
  const a: Moments = momentsOf(v, inputs(NOW, { heat: { value: 0.3, fromMs: NOW - 10, toMs: NOW + 20000 } }));
  const b = momentsOf(v, inputs(NOW, { heat: { value: 0.7, fromMs: NOW, toMs: NOW + 20000 }, linkLost: true }));
  assert.deepEqual(diffMoments(a, b), [
    { name: 'link-lost', lost: true },
    { name: 'heat' },
  ]);
  const paused = momentsOf(viewOf(FIXTURES.pause(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(a, paused), [{ name: 'pause', on: true }]);
});

test('the Interval prizes rotate every 8 s', () => {
  const state = FIXTURES.interval(NOW).state; // sinceMs = NOW - 40000: the 6th period starts at NOW + 8000
  const at = (ms: number) => momentsOf(viewOf(state), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(7999), at(8000)), [{ name: 'interval-rotate', index: 0 }]);
  assert.deepEqual(diffMoments(at(15999), at(16000)), [{ name: 'interval-rotate', index: 1 }]);
  assert.deepEqual(diffMoments(at(8000), at(9000)), []);
});
