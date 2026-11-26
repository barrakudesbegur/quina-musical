// Animation moments: named as in ANIMATIONS.md, timed by the show's clock, never replayed on a late join.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowOf, type FlowState } from '../../../../../packages/ui/flow.ts';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { stageView } from '../../../../stage/view.ts';
import { ANIM_NAMES, diffMoments, momentsOf, type AnimDetail, type MomentInputs, type Moments } from '../../../../stage/model/moments.ts';
import { NO_CHECK_MEMORY } from '../../../../stage/model/check.ts';
import type { LiveNotes } from '../../../../stage/view.ts';

const NOW = 1_800_000_000_000;
const inputs = (nowMs: number, extra: Partial<MomentInputs> = {}): MomentInputs => ({
  nowMs,
  heat: null,
  linkLost: false,
  checkMarkAt: 'end',
  checkTypeLeadMs: 900,
  countdown: { clockAboveMin: 90, fineBelowMin: 10, coarseStepMin: 5 },
  ...extra,
});
const viewOf = (state: FlowState, notes: LiveNotes = { landed: [], spin: null }) => stageView(state, flowOf(state), SAMPLE_PLAN, null, notes);
const names = (a: AnimDetail[]) => a.map((x) => x.name);

/** #57's Check (a Line, its third row) as the engine's snapshots carry it: `revealed` songs pressed 3 s apart from NOW
 * (2.5 s snippets; «Elefants», the 4th, a 1.2 s broken record), and the cue once it has played. */
function paced(revealed: number, patch: { cue?: 'pass' | 'fail'; reviewing?: boolean } = {}): FlowState {
  const { state } = FIXTURES.checkStarted(NOW);
  assert.ok(state.check);
  const songs = [2, 62, 16, 20];
  const steps = songs.slice(0, revealed).map((songId, i) => ({ songId, landed: songId !== 20, atMs: NOW + i * 3000, durationMs: songId === 20 ? 1200 : 2500 }));
  return { ...state, check: { ...state.check, startAtMs: NOW - 2000, revealed: steps, cue: patch.cue ?? null, reviewing: patch.reviewing ?? false } };
}

test('the hook names are exactly the ANIMATIONS.md projector hooks', () => {
  assert.deepEqual([...ANIM_NAMES].sort(), [
    'celebrate', 'check-enter', 'check-fallen', 'check-result', 'check-review', 'check-step', 'check-type', 'check-unreveal', 'credits',
    'finale-back', 'finale-clear', 'finale-enter', 'finale-fall', 'finale-safe', 'finale-win',
    'heat', 'idle', 'interval-rotate', 'landing', 'link-lost', 'pause', 'scene-enter', 'shuffle', 'spin', 'sponsor-pages', 'suspense',
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

test('check steps: each press reveals a song, playing then marked at its time; the result only at the cue', () => {
  const at = (revealed: number, ms: number, patch = {}) => momentsOf(viewOf(paced(revealed, patch)), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(0, 0), at(1, 0)), [{ name: 'check-step', index: 0, songId: 2, state: 'playing' }]);
  assert.deepEqual(diffMoments(at(1, 0), at(1, 2500)), [{ name: 'check-step', index: 0, songId: 2, state: 'landed' }]);
  assert.deepEqual(diffMoments(at(3, 9000), at(4, 9000)), [{ name: 'check-step', index: 3, songId: 20, state: 'playing' }]);
  assert.deepEqual(diffMoments(at(4, 9000), at(4, 10200)), [{ name: 'check-step', index: 3, songId: 20, state: 'missed' }]);
  assert.deepEqual(diffMoments(at(4, 10200), at(4, 60000)), [], 'every song marked: nothing until the cue');
  assert.deepEqual(diffMoments(at(4, 60000), at(4, 60000, { cue: 'fail' })), [{ name: 'check-result', result: 'incomplete' }]);
  // A cue pressed during the last snippet: its mark shows with the result.
  assert.deepEqual(diffMoments(at(4, 9500), at(4, 9500, { cue: 'fail' })), [
    { name: 'check-step', index: 3, songId: 20, state: 'missed' },
    { name: 'check-result', result: 'incomplete' },
  ]);
});

test('a step back lifts the last mark off; a review shows its plaque and keeps the marks', () => {
  // Under review from NOW + 4000 (as the stage heard it), while «Aserejé» (NOW + 3000, 2.5 s) was playing.
  const check = { ...NO_CHECK_MEMORY, review: { claimId: 'cl-5', atMs: NOW + 4000 } };
  const at = (revealed: number, ms: number, patch = {}) => momentsOf(viewOf(paced(revealed, patch), { landed: [], spin: null, check }), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(3, 9000), at(2, 9000)), [{ name: 'check-unreveal', index: 2, songId: 16 }]);
  assert.deepEqual(diffMoments(at(2, 9000), at(0, 9000)), [{ name: 'check-unreveal', index: 1, songId: 62 }, { name: 'check-unreveal', index: 0, songId: 2 }], 'the last first');
  assert.deepEqual(diffMoments(at(2, 4000), at(2, 4000, { reviewing: true })), [{ name: 'check-review', on: true }]);
  assert.deepEqual(diffMoments(at(2, 4000, { reviewing: true }), at(2, 9000, { reviewing: true })), [], 'nothing moves under review');
  assert.deepEqual(diffMoments(at(2, 9000, { reviewing: true }), at(2, 9000)), [
    { name: 'check-step', index: 1, songId: 62, state: 'landed' },
    { name: 'check-review', on: false },
  ], 'the Check goes on: the song cut short gets its mark');
});

test('scene changes: check → celebration → interval', () => {
  const check = momentsOf(viewOf(FIXTURES.check(NOW).state), inputs(NOW));
  const celebration = momentsOf(viewOf(FIXTURES.celebration(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(check, celebration), [
    { name: 'scene-enter', scene: 'celebration' },
    { name: 'celebrate', kind: 'line' },
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

test('the Interval countdown ticks when what it says changes, once a minute at most', () => {
  // guideEndMs = NOW + 140000: "3 minutes" until NOW + 20000, then "2 minutes"; under a minute it's "soon".
  const state = FIXTURES.interval(NOW).state;
  const at = (ms: number) => momentsOf(viewOf(state), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(0), at(19999)), []);
  assert.deepEqual(diffMoments(at(19999), at(20000)), [{ name: 'interval-rotate' }]);
  assert.deepEqual(diffMoments(at(79999), at(80000)), [{ name: 'interval-rotate' }], '"soon"');
  assert.deepEqual(diffMoments(at(80000), at(200000)), [], 'stays "soon" when overdue');
});

test('the card type: marked after the lead, before the first reveal; a wrong type only at its cue, with the result', () => {
  const at = (ms: number) => momentsOf(viewOf(paced(0)), inputs(NOW + ms));
  assert.deepEqual(diffMoments(at(-1101), at(-1100)), [{ name: 'check-type', ok: true }], '900 ms after the start');
  const wrong = FIXTURES.checkWrongType(NOW).state;
  assert.ok(wrong.check);
  const before = momentsOf(viewOf(wrong), inputs(NOW));
  assert.deepEqual(names(diffMoments(null, before)), ['scene-enter', 'check-enter'], 'nothing told before the cue');
  assert.deepEqual(diffMoments(before, momentsOf(viewOf(wrong), inputs(NOW + 60000))), []);
  const cued: FlowState = { ...wrong, check: { ...wrong.check, cue: 'fail' } };
  assert.deepEqual(diffMoments(before, momentsOf(viewOf(cued), inputs(NOW + 100))), [
    { name: 'check-type', ok: false },
    { name: 'check-result', result: 'notValid' },
  ]);
  const entered = diffMoments(null, momentsOf(viewOf(cued), inputs(NOW)));
  assert.deepEqual(entered.filter((a) => a.name === 'check-type'), [{ name: 'check-type', ok: false }], 'joined after the cue');
});

test("a fallen standing Check ends with `check-fallen` (not `check-result`); a valid one with the plaque's `check-result`", () => {
  const state = FIXTURES.checkFallen(NOW).state;
  const check = state.check;
  assert.ok(check);
  const at = (s: FlowState, ms: number) => momentsOf(viewOf(s), inputs(ms));
  const sank = check.revealed.length - 1;
  const markAt = check.revealed[sank].atMs + check.revealed[sank].durationMs;
  const playing: FlowState = { ...state, check: { ...check, revealed: check.revealed.map((r) => ({ ...r, atMs: r.atMs + 10_000 })) } };
  assert.deepEqual(diffMoments(at(playing, markAt + 10_000 - 1), at(playing, markAt + 10_000)), [{ name: 'check-step', index: sank, songId: 41, state: 'landed' }]);
  const cued: FlowState = { ...state, check: { ...check, cue: 'fail' } };
  assert.deepEqual(diffMoments(at(state, NOW), at(cued, NOW)), [{ name: 'check-fallen', cardId: 23 }]);

  const valid = FIXTURES.checkStandingValid(NOW).state;
  assert.ok(valid.check);
  const passed: FlowState = { ...valid, check: { ...valid.check, cue: 'pass' } };
  const entered = momentsOf(viewOf(passed), inputs(NOW));
  assert.equal(entered.check?.result, 'complete');
  assert.deepEqual(names(diffMoments(null, entered)), ['scene-enter', 'check-enter'], 'joining late never replays the result');
  assert.deepEqual(diffMoments(momentsOf(viewOf(valid), inputs(NOW)), entered), [{ name: 'check-result', result: 'complete' }]);
});

test('the Desgraciat celebration: `celebrate` with kind standing', () => {
  const play = momentsOf(viewOf(FIXTURES.desgraciatLast(NOW).state), inputs(NOW));
  const celebration = momentsOf(viewOf(FIXTURES.celebrationStanding(NOW).state), inputs(NOW));
  assert.deepEqual(diffMoments(play, celebration), [
    { name: 'scene-enter', scene: 'celebration' },
    { name: 'celebrate', kind: 'standing' },
  ]);
});
