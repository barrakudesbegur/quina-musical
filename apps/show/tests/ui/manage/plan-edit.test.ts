// Plan edits: rounds renumbered after every change, sponsor ids and references, the schedule's local time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan } from '../../../ui/plan.ts';
import { SAMPLE_PLAN } from '../../../ui/fixtures/plan.ts';
import {
  addRound,
  blankPlan,
  fromLocalInput,
  moveRound,
  plannedEndMs,
  removeRound,
  removeSponsor,
  renameSponsor,
  slugify,
  sponsorIdFor,
  sponsorUsage,
  toLocalInput,
} from '../../../manage/logic/plan-edit.ts';

const numbers = (rounds: { number: number }[]) => rounds.map((r) => r.number);

test('adding, removing and moving rounds keeps them numbered 1, 2, 3…', () => {
  const three = addRound(addRound(blankPlan('26', 'Quina Musical', SAMPLE_PLAN.cheatSheet).rounds), 'special');
  assert.deepEqual(numbers(three), [1, 2, 3]);
  assert.equal(three[2].kind, 'special');
  const moved = moveRound(three, 2, 0);
  assert.deepEqual(numbers(moved), [1, 2, 3]);
  assert.equal(moved[0].kind, 'special');
  assert.deepEqual(numbers(removeRound(moved, 1)), [1, 2]);
  assert.deepEqual(numbers(moveRound(three, 0, 99)), [1, 2, 3], 'out-of-range targets are clamped');
  assert.equal(removeRound(three, 7).length, 3, 'removing a missing round changes nothing');
});

test('edits never mutate their input', () => {
  const rounds = structuredClone(SAMPLE_PLAN.rounds);
  const before = JSON.stringify(rounds);
  moveRound(rounds, 0, 3);
  removeRound(rounds, 2);
  assert.equal(JSON.stringify(rounds), before);
});

test('a blank plan (once given prize titles) passes the validator', () => {
  const plan = blankPlan('26', 'Quina Musical', SAMPLE_PLAN.cheatSheet);
  assert.equal(checkGamePlan(plan).ok, false, 'empty prize titles are reported, not hidden');
  plan.rounds[0].line!.title = 'Coca';
  plan.rounds[0].bingo!.title = 'Pernil';
  assert.equal(checkGamePlan(plan).ok, true);
});

test('slugify and unique sponsor ids', () => {
  assert.equal(slugify('Forn Can Pep, S.L.'), 'forn-can-pep-s-l');
  assert.equal(slugify("Cal Ràfols · l'Àvia"), 'cal-rafols-l-avia');
  assert.equal(slugify('!!!'), '');
  assert.equal(sponsorIdFor('Forn', ['forn', 'forn-2']), 'forn-3');
  assert.equal(sponsorIdFor('', []), 'patrocinador');
});

test('renaming a sponsor id keeps prizes pointing at it', () => {
  const renamed = renameSponsor(SAMPLE_PLAN, 'patrocinador-1', 'forn-can-pep');
  assert.equal(checkGamePlan(renamed).ok, true);
  assert.equal(sponsorUsage(renamed, 'forn-can-pep'), sponsorUsage(SAMPLE_PLAN, 'patrocinador-1'));
  assert.equal(sponsorUsage(renamed, 'patrocinador-1'), 0);
});

test('removing a sponsor clears its prizes and says how many', () => {
  const used = sponsorUsage(SAMPLE_PLAN, 'patrocinador-2');
  const { plan, cleared } = removeSponsor(SAMPLE_PLAN, 'patrocinador-2');
  assert.equal(cleared, used);
  assert.ok(used > 0);
  assert.equal(checkGamePlan(plan).ok, true);
});

test('local date-time inputs round-trip in this time zone, junk reads as null', () => {
  const ms = new Date(2026, 11, 26, 18, 30).getTime();
  assert.equal(toLocalInput(ms), '2026-12-26T18:30');
  assert.equal(fromLocalInput('2026-12-26T18:30'), ms);
  assert.equal(fromLocalInput(toLocalInput(ms)), ms);
  assert.equal(toLocalInput(null), '');
  assert.equal(fromLocalInput(''), null);
  assert.equal(fromLocalInput('2026-02-30T10:00'), null);
  assert.equal(fromLocalInput('demà'), null);
});

test('the planned end adds the rounds and the Intervals between them', () => {
  const start = new Date(2026, 11, 26, 18, 0).getTime();
  const plan = { rounds: SAMPLE_PLAN.rounds.slice(0, 3), schedule: { startAtMs: start, roundMinutes: 25, intervalMinutes: 5 } };
  assert.equal(plannedEndMs(plan), start + (3 * 25 + 2 * 5) * 60_000);
  assert.equal(plannedEndMs({ ...plan, schedule: { ...plan.schedule, startAtMs: null } }), null);
});
