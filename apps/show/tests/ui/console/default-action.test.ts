// The default action (what the console draws as primary and the Wii's A sends), per scene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf, type AnyCommandName, type FlowState } from '../../../../../packages/ui/flow.ts';
import type { GamePlan } from '../../../../../packages/ui/plan.ts';
import { defaultAction, sendDefault, type DefaultActionInput } from '../../../../console/logic/default-action.ts';
import { canSend, controlsModel } from '../../../../console/logic/scene.ts';

const NOW = 1_800_000_000_000;

/** The console's input for a fixture, as ConsoleModel builds it (online). */
function input(state: FlowState | null, nowMs = NOW, plan: GamePlan | null = null): DefaultActionInput {
  const flow = flowOf(state);
  const controls = { state, flow, online: true };
  return { state, flow, nowMs, plan, nextEnabled: controlsModel(controls).next.enabled, can: (cmd: AnyCommandName) => canSend(cmd, controls) };
}
const of = (name: string, nowMs = NOW) => defaultAction(input(FIXTURES[name](NOW).state, nowMs));

test('in play it is Següent; during a Spin Següent stays the default but is disabled', () => {
  assert.deepEqual(of('play'), { control: 'next', command: { cmd: 'next' }, enabled: true });
  assert.deepEqual(of('spin'), { control: 'next', command: { cmd: 'next' }, enabled: false });
  assert.deepEqual(of('suspense'), { control: 'next', command: { cmd: 'next' }, enabled: true }, 'Següent releases an open Suspens');
  assert.equal(of('hold')?.control, 'next');
});

test('a Check: the big button, with the step each press expects; nothing under review or between cards', () => {
  assert.deepEqual(of('checkStarted'), { control: 'check', command: { cmd: 'checkNext', args: { claimId: 'cl-5', step: 0 } }, enabled: true }, 'the first reveal');
  assert.deepEqual(of('check')?.command, { cmd: 'checkNext', args: { claimId: 'cl-5', step: 2 } });
  assert.deepEqual(of('checkValid')?.command, { cmd: 'checkNext', args: { claimId: 'cl-7', step: 4 } }, 'the cue: «Celebrem!»');
  assert.deepEqual(of('checkFailed')?.command, { cmd: 'checkNext', args: { claimId: 'cl-5', step: 4 } }, 'the cue: «Fallada»');
  assert.deepEqual(of('checkWrongType')?.command, { cmd: 'checkNext', args: { claimId: 'cl-8', step: 0 } }, 'a card of the wrong type: the first press is the cue');
  assert.deepEqual(of('checkCelebrateNext')?.command, { cmd: 'checkNext', args: { claimId: 'cl-6', step: 2 } }, 'the shared Celebration');
  assert.deepEqual(of('checkAuto')?.command, { cmd: 'checkAuto', args: { on: false } }, '«Seguides» on: a press stops it');
  assert.equal(of('checkReview'), null, 'under review A does nothing (D135)');
  assert.equal(of('checkCuePass'), null, 'the next card comes on screen by itself');
});

test('the claim pad, while open, takes A: «Comprovar» its numbers, nothing while it has none', () => {
  const s = FIXTURES.check(NOW).state;
  const claim = { cardIds: [57, 204], kind: 'line' as const };
  assert.deepEqual(defaultAction({ ...input(s), pad: { claim } }), { control: 'claimPad', command: { cmd: 'claim', args: claim }, enabled: true });
  assert.equal(defaultAction({ ...input(s), pad: { claim: null } }), null, 'never the Check underneath');
});

test('round start: Barreja once introduced, nothing during the Shuffle, then Següent', () => {
  // Bare: the engine plays the introduced round's card type (roundIntro sent it).
  assert.deepEqual(of('roundStart'), { control: 'shuffle', command: { cmd: 'newRound' }, enabled: true });
  assert.equal(of('shuffle'), null, 'the Shuffle runs');
  const shuffle = FIXTURES.shuffle(NOW).state.shuffle;
  assert.ok(shuffle);
  assert.deepEqual(of('shuffle', shuffle.endAtMs), { control: 'next', command: { cmd: 'next' }, enabled: true }, 'shuffled: the first song');
});

test('Celebration: Següent after a Line, the Interval after a Bingo', () => {
  assert.deepEqual(of('celebration'), { control: 'next', command: { cmd: 'next' }, enabled: true });
  assert.deepEqual(of('celebrationBingo'), { control: 'interval', command: { cmd: 'interval' }, enabled: true });
});

test("the Interval starts the next round, with its kind and card type from the plan when there is one", () => {
  assert.deepEqual(of('interval'), { control: 'roundIntro', command: { cmd: 'roundIntro', args: { number: 4 } }, enabled: true });
  const plan = { rounds: [1, 2, 3, 4].map((number) => ({ number, kind: number === 4 ? 'special' : 'normal', line: [], bingo: [] })) } as unknown as GamePlan;
  const withPlan = defaultAction(input(FIXTURES.interval(NOW).state, NOW, plan));
  assert.deepEqual(withPlan?.command, { cmd: 'roundIntro', args: { number: 4, kind: 'special', cardType: 'especial' } }, "a plan without card types: the kind's default");
  plan.rounds[3] = { ...plan.rounds[3], kind: 'normal', cardType: 'desgraciat' };
  assert.deepEqual(defaultAction(input(FIXTURES.interval(NOW).state, NOW, plan))?.command, { cmd: 'roundIntro', args: { number: 4, kind: 'normal', cardType: 'desgraciat' } });
});

test('Pausa: end it, whatever the scene underneath', () => {
  assert.deepEqual(of('pause'), { control: 'endPause', command: { cmd: 'pause', args: { on: false } }, enabled: true });
  const s = FIXTURES.checkValid(NOW).state;
  assert.equal(defaultAction(input({ ...s, pause: { sinceMs: NOW - 1000, overlay: true } }))?.control, 'endPause');
});

test('before and after the night, and without a snapshot: nothing', () => {
  assert.equal(of('before'), null);
  assert.equal(of('after'), null);
  assert.equal(defaultAction(input(null)), null);
});

test('sendDefault sends exactly the command, and nothing for a disabled or missing default', () => {
  const sent: unknown[][] = [];
  const act = ((cmd: string, ...args: unknown[]) => (sent.push([cmd, ...args]), 'r1')) as Parameters<typeof sendDefault>[0];
  assert.equal(sendDefault(act, of('checkValid')), 'r1');
  assert.equal(sendDefault(act, of('checkAuto')), 'r1');
  assert.equal(sendDefault(act, of('play')), 'r1');
  assert.equal(sendDefault(act, of('spin')), null);
  assert.equal(sendDefault(act, null), null);
  assert.deepEqual(sent, [['checkNext', { claimId: 'cl-7', step: 4 }], ['checkAuto', { on: false }], ['next']]);
});
