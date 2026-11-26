// Horari's rows (logic/timeline.ts, board Mobil-B-J2): the rounds with real or "~" times and the end of the night;
// only what the model has a time for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { timelineKey, timelineOf } from '../../../../player/logic/timeline.ts';
import { plannedStarts } from '../../../../player/logic/view.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';

const MIN = 60_000;
const T = 1_700_000_000_000;
const PLAIN = publicPlan(SAMPLE_PLAN, [1, 2, 3]);
const TIMED = { ...PLAIN, schedule: { startAtMs: T, roundMinutes: 20, intervalMinutes: 5, breaks: [{ afterRound: 3, minutes: 10 }] } };
const round = (number: number, startedAtMs: number, ended: boolean) => ({ number, kind: 'normal' as const, startedAtMs, lineConfirmed: false, ended, landings: [] });
const state = (patch: Partial<PublicState> = {}): PublicState => ({
  ...emptyPublicState('26'),
  gameId: 'g',
  scene: 'play',
  rounds: [round(1, T + 2 * MIN, true), round(2, T + 30 * MIN, true), round(3, T + 58 * MIN, false)],
  gameEndMs: T + 240 * MIN,
  ...patch,
});

test('planned starts allow for the planned breaks before each round', () => {
  const starts = plannedStarts(TIMED);
  assert.equal(starts?.get(1), T);
  assert.equal(starts?.get(3), T + 50 * MIN, 'two rounds and two Intervals');
  assert.equal(starts?.get(4), T + 85 * MIN, 'three of each, and the 10-minute break after Quina 3');
  assert.equal(starts?.get(8), T + 185 * MIN);
});

test('rounds: real times once started, "~" planned times for the rest, done / current / next', () => {
  const rows = timelineOf(TIMED, state());
  const rounds = rows.filter((r) => r.kind === 'round');
  assert.deepEqual(rounds.map((r) => r.state), ['done', 'done', 'current', 'next', 'next', 'next', 'next', 'next']);
  assert.deepEqual(rounds.slice(0, 4).map((r) => [r.atMs, r.predicted]), [[T + 2 * MIN, false], [T + 30 * MIN, false], [T + 58 * MIN, false], [T + 85 * MIN, true]]);
  assert.deepEqual(rounds.map((r) => r.roundKind).slice(4, 7), ['desgraciat', 'normal', 'special'], "the plan's kinds");
});

test("no break rows: the plan's planned breaks are the throws, still open for Horari (D136, U123)", () => {
  assert.deepEqual(timelineOf(TIMED, state()).map(timelineKey).slice(2, 4), ['round:3', 'round:4']);
});

test('the end: the cloud\'s expected end, else the plan\'s; gone once the night is over', () => {
  assert.deepEqual(timelineOf(TIMED, state()).at(-1), { kind: 'end', state: 'next', atMs: T + 240 * MIN, predicted: true });
  assert.equal(timelineOf(TIMED, state({ gameEndMs: null })).at(-1)?.atMs, T + 205 * MIN, "the last round's planned end");
  assert.equal(timelineOf(PLAIN, state({ gameEndMs: null })).at(-1)?.kind, 'round', 'no time anywhere: no end row');
  assert.equal(timelineOf(TIMED, state({ scene: 'after' })).some((r) => r.kind === 'end'), false);
  assert.deepEqual(timelineOf(null, null), [], 'nothing at all: no rows');
});

test('before the night: every round still to come, with its planned time', () => {
  const rows = timelineOf(TIMED, state({ scene: 'before', rounds: [], gameEndMs: null }));
  assert.equal(rows[0].kind === 'round' && rows[0].state, 'next');
  assert.deepEqual([rows[0].atMs, rows[0].kind === 'round' && rows[0].predicted], [T, true]);
  assert.equal(timelineOf(PLAIN, state({ scene: 'before', rounds: [] }))[0].atMs, null, 'no planned start: no time');
});
