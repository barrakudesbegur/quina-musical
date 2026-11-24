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

test('a Check: nothing while it runs, then the verdict its result points to', () => {
  assert.equal(of('check'), null, 'still running');
  const check = FIXTURES.check(NOW).state.check;
  assert.ok(check);
  assert.deepEqual(of('check', check.endAtMs), { control: 'reject', command: { cmd: 'decide', args: { claimId: 'cl-5', valid: false } }, enabled: true }, 'due: an incomplete card is rejected');
  assert.deepEqual(of('checkValid'), { control: 'confirm', command: { cmd: 'decide', args: { claimId: 'cl-7', valid: true } }, enabled: true });
  assert.deepEqual(of('checkFailed')?.command, { cmd: 'decide', args: { claimId: 'cl-5', valid: false } });
  assert.equal(of('checkWrongType', NOW + 600)?.control, 'reject', 'a card of the wrong type');
});

test('a decided Check offers nothing more', () => {
  const s = FIXTURES.checkValid(NOW).state;
  const decided = { ...s, claims: s.claims.map((c) => ({ ...c, status: 'valid' as const })) };
  assert.equal(defaultAction(input(decided)), null);
});

test('round start: Barreja once introduced, nothing during the Shuffle, then Següent', () => {
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

test('the Interval starts the next round, with its kind from the plan when there is one', () => {
  assert.deepEqual(of('interval'), { control: 'roundIntro', command: { cmd: 'roundIntro', args: { number: 4 } }, enabled: true });
  const plan = { rounds: [1, 2, 3, 4].map((number) => ({ number, kind: number === 4 ? 'special' : 'normal', line: [], bingo: [] })) } as unknown as GamePlan;
  const withPlan = defaultAction(input(FIXTURES.interval(NOW).state, NOW, plan));
  assert.deepEqual(withPlan?.command, { cmd: 'roundIntro', args: { number: 4, kind: 'special' } });
});

test('Pausa: end it, whatever the scene underneath', () => {
  assert.deepEqual(of('pause'), { control: 'endPause', command: { cmd: 'pause', args: { on: false } }, enabled: true });
  const s = FIXTURES.checkValid(NOW).state;
  assert.equal(defaultAction(input({ ...s, pause: { sinceMs: NOW - 1000 } }))?.control, 'endPause');
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
  assert.equal(sendDefault(act, of('play')), 'r1');
  assert.equal(sendDefault(act, of('spin')), null);
  assert.equal(sendDefault(act, null), null);
  assert.deepEqual(sent, [['decide', { claimId: 'cl-7', valid: true }], ['next']]);
});
