// Horari's rows (logic/timeline.ts, board Mobil-B-J2; D150, D152): "Venda de cartrons" when the plan has the doors'
// time, the rounds with real or "~" times, a descans after each planned Throw's round, and the end of the night; only
// what the model has a time for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { timelineKey, timelineOf } from '../../../../player/logic/timeline.ts';
import { plannedStarts } from '../../../../player/logic/view.ts';
import { S } from '../../../../player/strings.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';

const MIN = 60_000;
const T = 1_700_000_000_000;
const PLAIN = publicPlan(SAMPLE_PLAN, [1, 2, 3]);
const THROWS = [{ afterRound: 1, minutes: 5 }, { afterRound: 3, minutes: 10 }];
const TIMED = { ...PLAIN, schedule: { startAtMs: T, roundMinutes: 20, intervalMinutes: 5, throws: THROWS } };
const DOORS = { ...TIMED, schedule: { ...TIMED.schedule, doorsAtMs: T - 30 * MIN } };
const round = (number: number, startedAtMs: number, ended: boolean) => ({ number, kind: 'normal' as const, startedAtMs, lineConfirmed: false, ended, landings: [] });
const state = (patch: Partial<PublicState> = {}): PublicState => ({
  ...emptyPublicState('26'),
  gameId: 'g',
  scene: 'play',
  rounds: [round(1, T + 2 * MIN, true), round(2, T + 30 * MIN, true), round(3, T + 58 * MIN, false)],
  gameEndMs: T + 240 * MIN,
  ...patch,
});
const BEFORE = { scene: 'before', rounds: [], gameEndMs: null } as const;

test("planned starts count a planned Throw's break in place of the Interval it replaces (D192)", () => {
  const starts = plannedStarts(TIMED);
  assert.equal(starts?.get(1), T);
  assert.equal(starts?.get(2), T + 25 * MIN, 'a round and the 5-minute break with the Throw after Quina 1 (no Interval on top)');
  assert.equal(starts?.get(3), T + 50 * MIN, 'two rounds, that break and an Interval');
  assert.equal(starts?.get(4), T + 80 * MIN, 'three rounds, and the 10-minute break with the Throw after Quina 3');
  assert.equal(starts?.get(8), T + 180 * MIN, '7 rounds, 5 Intervals and the two Throws\' breaks');
});

test('rounds: real times once started, "~" planned times for the rest, done / current / next', () => {
  const rows = timelineOf(TIMED, state());
  const rounds = rows.filter((r) => r.kind === 'round');
  assert.deepEqual(rounds.map((r) => r.state), ['done', 'done', 'current', 'next', 'next', 'next', 'next', 'next']);
  assert.deepEqual(rounds.slice(0, 4).map((r) => [r.atMs, r.predicted]), [[T + 2 * MIN, false], [T + 30 * MIN, false], [T + 58 * MIN, false], [T + 80 * MIN, true]]);
  assert.deepEqual(rounds.map((r) => r.roundKind).slice(4, 7), ['desgraciat', 'normal', 'special'], "the plan's kinds");
});

test('a descans after each planned Throw\'s round, in order, at that round\'s planned end; done once a later round started (D150)', () => {
  const rows = timelineOf(TIMED, state());
  assert.deepEqual(rows.map(timelineKey).slice(0, 6), ['round:1', 'throw:1', 'round:2', 'round:3', 'throw:3', 'round:4']);
  const throws = rows.filter((r) => r.kind === 'throw');
  assert.deepEqual(throws, [
    { kind: 'throw', order: 1, afterRound: 1, state: 'done', atMs: T + 20 * MIN, predicted: false },
    { kind: 'throw', order: 2, afterRound: 3, state: 'next', atMs: T + 70 * MIN, predicted: true },
  ]);
  assert.deepEqual([S.scheduleThrow(1), S.scheduleThrow(2), S.scheduleThrow(3)], ['Primer descans', 'Segon descans', 'Tercer descans']);
  const unsorted = { ...TIMED, schedule: { ...TIMED.schedule, throws: [...THROWS].reverse() } };
  assert.deepEqual(timelineOf(unsorted, state()), rows, 'numbered by their rounds, whatever order the plan lists them in');
  assert.equal(timelineOf(TIMED, state({ rounds: state().rounds.slice(0, 1) })).find((r) => r.kind === 'throw')?.state, 'next', 'still to come while its round plays');
  const untimed = timelineOf({ ...PLAIN, schedule: { ...PLAIN.schedule, throws: THROWS } }, state());
  assert.deepEqual(untimed.filter((r) => r.kind === 'throw').map((r) => [r.atMs, r.predicted]), [[null, false], [null, false]], 'no planned start: in place, no time');
  assert.equal(timelineOf(PLAIN, state()).some((r) => r.kind === 'throw'), false, 'no planned Throws: no descans');
});

test('"Venda de cartrons" first, only when the plan has the doors\' time: "~" until the first round starts (D152)', () => {
  assert.deepEqual(timelineOf(DOORS, state())[0], { kind: 'doors', state: 'done', atMs: T - 30 * MIN, predicted: false });
  assert.deepEqual(timelineOf(DOORS, state(BEFORE))[0], { kind: 'doors', state: 'next', atMs: T - 30 * MIN, predicted: true });
  assert.equal(timelineOf(TIMED, state())[0].kind, 'round', 'no doors time: the rounds first');
  assert.equal(timelineOf({ ...PLAIN, schedule: { ...PLAIN.schedule, doorsAtMs: T } }, state(BEFORE))[0].atMs, T, 'its own time, with or without a start');
  assert.deepEqual(timelineOf({ ...DOORS, rounds: [] }, null), [], 'nothing planned: no rows');
});

test('the end: the cloud\'s expected end, else the plan\'s; gone once the night is over', () => {
  assert.deepEqual(timelineOf(TIMED, state()).at(-1), { kind: 'end', state: 'next', atMs: T + 240 * MIN, predicted: true });
  assert.equal(timelineOf(TIMED, state({ gameEndMs: null })).at(-1)?.atMs, T + 200 * MIN, "the last round's planned end");
  assert.equal(timelineOf(PLAIN, state({ gameEndMs: null })).at(-1)?.kind, 'round', 'no time anywhere: no end row');
  const after = timelineOf(DOORS, state({ scene: 'after', rounds: SAMPLE_PLAN.rounds.map((r) => round(r.number, T + r.number * 25 * MIN, true)) }));
  assert.equal(after.some((r) => r.kind === 'end'), false);
  assert.deepEqual(after.filter((r) => r.kind !== 'round').map((r) => r.state), ['done', 'done', 'done'], 'the doors and the descans stay, done');
  assert.deepEqual(timelineOf(null, null), [], 'nothing at all: no rows');
});

test('before the night: every round still to come, with its planned time', () => {
  const rows = timelineOf(TIMED, state(BEFORE));
  assert.equal(rows[0].kind === 'round' && rows[0].state, 'next');
  assert.deepEqual([rows[0].atMs, rows[0].kind === 'round' && rows[0].predicted], [T, true]);
  assert.equal(timelineOf(PLAIN, state({ scene: 'before', rounds: [] }))[0].atMs, null, 'no planned start: no time');
  assert.ok(rows.filter((r) => r.kind === 'throw').every((r) => r.state === 'next' && r.predicted));
});

test('every row has its own key', () => {
  const keys = timelineOf(DOORS, state()).map(timelineKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([keys[0], keys.at(-1)], ['doors', 'end']);
});
