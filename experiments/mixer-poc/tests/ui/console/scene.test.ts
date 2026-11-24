// What the console offers in each scene (mirroring the engine's scene rules), and the thumb cluster.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, baseState } from '../../../ui/fixtures/states.ts';
import { flowOf, type FlowState } from '../../../ui/flow.ts';
import { canSend, controlsModel, sceneAllows, sceneContext } from '../../../console/logic/scene.ts';

const NOW = 1_800_000_000_000;
const input = (state: FlowState, online = true) => ({ state, flow: flowOf(state), online });
const fixture = (name: string) => input(FIXTURES[name](NOW).state);

test('in play every big button is available', () => {
  const c = controlsModel(fixture('play'));
  assert.equal(c.live, true);
  assert.deepEqual([c.next.enabled, c.hold.enabled, c.suspense.enabled, c.back.enabled, c.claim.enabled], [true, true, true, true, true]);
  assert.equal(c.hold.holding, false);
});

test('offline or locked: nothing can be sent', () => {
  for (const c of [controlsModel(input(FIXTURES.play(NOW).state, false)), controlsModel(input({ ...baseState(NOW), status: 'locked' }))]) {
    assert.equal(c.live, false);
    assert.equal(c.next.enabled || c.hold.enabled || c.claim.enabled || c.back.enabled || c.suspense.enabled, false);
  }
  assert.equal(canSend('panic', input(FIXTURES.play(NOW).state, false)), false);
});

test('during a Spin, Next and Suspense wait; Back cancels; Hold works', () => {
  const c = controlsModel(fixture('spin'));
  assert.equal(c.next.enabled, false);
  assert.equal(c.suspense.enabled, false);
  assert.equal(c.back.enabled, true);
  assert.equal(c.hold.enabled, true);
});

test('an open Suspense: Next and Suspense release it', () => {
  const c = controlsModel(fixture('suspense'));
  assert.equal(c.suspense.open, true);
  assert.equal(c.next.enabled, true);
  assert.equal(c.suspense.enabled, true);
});

test('in a Hold the Hold button resumes', () => {
  const c = controlsModel(fixture('hold'));
  assert.equal(c.hold.holding, true);
  assert.equal(c.hold.enabled, true);
});

test('in a Check: Claim adds another card, Next and Suspense are refused', () => {
  const c = controlsModel(fixture('check'));
  assert.equal(c.claim.enabled, true);
  assert.equal(c.next.enabled, false);
  assert.equal(c.suspense.enabled, false);
  assert.equal(canSend('decide', fixture('check')), true);
  assert.equal(canSend('checkStart', fixture('check')), true);
  assert.equal(canSend('celebrationMusic', fixture('check')), false);
});

test("a Line's Celebration goes back to play with Next; a Bingo's goes to the Interval", () => {
  const line = fixture('celebration');
  assert.equal(controlsModel(line).next.enabled, true);
  assert.equal(canSend('interval', line), false);
  assert.equal(canSend('celebrationMusic', line), true);
  const bingo = fixture('celebrationBingo');
  assert.equal(controlsModel(bingo).next.enabled, false);
  assert.equal(canSend('interval', bingo), true);
  assert.equal(canSend('roundIntro', bingo), true);
});

test('roundStart: Barrejar before the Shuffle, Next once it is drawn', () => {
  const intro = fixture('roundStart');
  assert.equal(sceneContext(intro.flow).introduced, true);
  assert.equal(controlsModel(intro).next.enabled, false);
  assert.equal(canSend('newRound', intro), true);
  const shuffling = fixture('shuffle');
  assert.equal(sceneContext(shuffling.flow).introduced, false);
  assert.equal(controlsModel(shuffling).next.enabled, true);
});

test('roundStart reads the introduced round from flow.intro', () => {
  const s = { ...FIXTURES.roundStart(NOW).state, intro: { round: 4, kind: 'special' as const, sinceMs: NOW } };
  assert.equal(sceneContext(flowOf(s)).introduced, true);
  const drawn = { ...s, intro: null };
  assert.equal(sceneContext(flowOf(drawn)).introduced, false);
  assert.equal(flowOf(baseState(NOW)).intro, null, 'no intro outside roundStart');
});

test('the Interval: only Start round; the big buttons rest', () => {
  const c = fixture('interval');
  assert.equal(canSend('roundIntro', c), true);
  const m = controlsModel(c);
  assert.equal(m.next.enabled || m.hold.enabled || m.claim.enabled || m.back.enabled || m.suspense.enabled, false);
});

test('the technical pause lets only the always-allowed commands through', () => {
  const c = fixture('pause');
  const ctx = sceneContext(c.flow);
  assert.equal(ctx.paused, true);
  assert.equal(sceneAllows('next', ctx), false);
  assert.equal(sceneAllows('claim', ctx), false);
  assert.equal(sceneAllows('pause', ctx), true);
  assert.equal(sceneAllows('panic', ctx), true);
  assert.equal(sceneAllows('sfx', ctx), true);
});

test('before the night: Next works (a fresh Game plays like play), Back only with something to undo', () => {
  const c = controlsModel(fixture('before'));
  assert.equal(c.next.enabled, true);
  assert.equal(c.back.enabled, false);
  assert.equal(c.claim.enabled, false);
});

test('a command the table does not know is left to the engine', () => {
  assert.equal(sceneAllows('overrideNextRecipe', sceneContext(flowOf(null))), true);
});

test('no Hold toggle during a Check: releasing it would bring the song back mid-Check (engine rule)', () => {
  const c = controlsModel(fixture('check'));
  assert.equal(c.hold.enabled, false);
});
