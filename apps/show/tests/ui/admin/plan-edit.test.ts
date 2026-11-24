// Plan edits: rounds renumbered after every change, prize bundles (headline prizes first), sponsor ids and
// references, card prices, the schedule's local time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import {
  addPrize,
  addRound,
  blankPlan,
  blankPrize,
  fromLocalInput,
  lockedRoundCount,
  movePrize,
  moveRound,
  plannedEndMs,
  prizeMoveRange,
  removePrize,
  removeRound,
  removeSponsor,
  renameSponsor,
  setHeadline,
  slugify,
  sortBundle,
  sponsorIdFor,
  sponsorUsage,
  toLocalInput,
} from '../../../../admin/logic/plan-edit.ts';

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

test('during the night, played rounds and the one in play stay fixed; upcoming ones move live', () => {
  const rounds = structuredClone(SAMPLE_PLAN.rounds);
  const locked = lockedRoundCount({ number: 3, startedAtMs: 1 });
  assert.equal(locked, 3);
  const kinds = (rs: { kind: string }[]) => rs.map((r) => r.kind).join(',');
  assert.equal(kinds(moveRound(rounds, 2, 5, locked)), kinds(rounds), 'the round in play never moves');
  assert.equal(kinds(moveRound(rounds, 6, 0, locked).slice(0, 3)), kinds(rounds.slice(0, 3)), 'nothing moves above the fixed rounds');
  const moved = moveRound(rounds, 6, 0, locked);
  assert.equal(moved[3].kind, rounds[6].kind, 'the special round becomes the next one');
  assert.deepEqual(numbers(moved), numbers(rounds), 'still numbered 1, 2, 3…');
  assert.equal(removeRound(rounds, 1, locked).length, rounds.length, 'a played round is never removed');
  assert.equal(removeRound(rounds, 4, locked).length, rounds.length - 1);
});

test('the fixed rounds: none before the night, and an introduced round counts as in play', () => {
  assert.equal(lockedRoundCount(null), 0);
  assert.equal(lockedRoundCount({ number: 0, startedAtMs: 0 }), 0);
  assert.equal(lockedRoundCount({ number: 0, startedAtMs: 0 }, 1), 1);
  assert.equal(lockedRoundCount({ number: 3, startedAtMs: 1 }, 4), 4);
});

test('edits never mutate their input', () => {
  const rounds = structuredClone(SAMPLE_PLAN.rounds);
  const before = JSON.stringify(rounds);
  moveRound(rounds, 0, 3);
  removeRound(rounds, 2);
  assert.equal(JSON.stringify(rounds), before);
});

test('a blank plan passes the validator; a blank prize is reported until it has a title', () => {
  const plan = blankPlan('26', 'Quina Quina 3', SAMPLE_PLAN.cheatSheet);
  assert.equal(plan.prizeReveal, 'perRound');
  assert.deepEqual(plan.cardTypes.map((c) => c.type), ['normal', 'especial']);
  assert.deepEqual([plan.rounds[0].line, plan.rounds[0].bingo], [[], []], 'no prizes yet');
  assert.equal(checkGamePlan(plan).ok, true);
  plan.rounds[0].bingo = addPrize(plan.rounds[0].bingo, true);
  assert.equal(checkGamePlan(plan).ok, false, 'empty prize titles are reported, not hidden');
  plan.rounds[0].bingo[0].title = 'Pernil';
  assert.equal(checkGamePlan(plan).ok, true);
});

const named = (title: string, headline = false) => ({ ...blankPrize(headline), title });
const titles = (bundle: { title: string }[]) => bundle.map((p) => p.title);
const BUNDLE = [named('A', true), named('B', true), named('c'), named('d'), named('e')];

test('a bundle: add, remove and move prizes; headline ones always stay first', () => {
  assert.deepEqual(titles(addPrize(BUNDLE)), ['A', 'B', 'c', 'd', 'e', ''], 'a smaller prize goes last');
  const withHeadline = addPrize(BUNDLE, true);
  assert.deepEqual(titles(withHeadline), ['A', 'B', '', 'c', 'd', 'e'], 'a headline prize joins the headline ones');
  assert.equal(withHeadline[2].headline, true);
  assert.deepEqual(titles(removePrize(BUNDLE, 0)), ['B', 'c', 'd', 'e']);
  assert.deepEqual(titles(movePrize(BUNDLE, 3, 2)), ['A', 'B', 'd', 'c', 'e']);
  assert.deepEqual(titles(movePrize(BUNDLE, 2, 0)), ['A', 'B', 'c', 'd', 'e'], 'a smaller prize never climbs above a headline one');
  assert.deepEqual(titles(movePrize(BUNDLE, 1, 4)), ['A', 'B', 'c', 'd', 'e'], 'a headline prize never drops below a smaller one');
  assert.deepEqual(titles(movePrize(BUNDLE, 1, 0)), ['B', 'A', 'c', 'd', 'e']);
  assert.deepEqual(prizeMoveRange(BUNDLE, 0), { min: 0, max: 1 });
  assert.deepEqual(prizeMoveRange(BUNDLE, 3), { min: 2, max: 4 });
});

test('marking a prize "Destacat" moves it up with the headline ones; unmarking moves it down', () => {
  const up = setHeadline(BUNDLE, 3, true);
  assert.deepEqual(titles(up), ['A', 'B', 'd', 'c', 'e']);
  assert.deepEqual(up.map((p) => p.headline), [true, true, true, false, false]);
  const down = setHeadline(BUNDLE, 0, false);
  assert.deepEqual(titles(down), ['B', 'A', 'c', 'd', 'e']);
  assert.deepEqual(down.map((p) => p.headline), [true, false, false, false, false]);
  assert.deepEqual(titles(sortBundle([named('x'), named('Y', true), named('z')])), ['Y', 'x', 'z']);
  for (const edited of [up, down, addPrize(BUNDLE, true), movePrize(BUNDLE, 4, 0)]) {
    const plan = structuredClone(SAMPLE_PLAN);
    plan.rounds[0].line = edited.map((p) => ({ ...p, title: p.title || 'x' }));
    assert.equal(checkGamePlan(plan).ok, true, 'every edit keeps the bundle valid');
  }
});

test('bundle edits never mutate their input', () => {
  const bundle = structuredClone(BUNDLE);
  const before = JSON.stringify(bundle);
  addPrize(bundle, true);
  removePrize(bundle, 1);
  movePrize(bundle, 3, 2);
  setHeadline(bundle, 4, true);
  assert.equal(JSON.stringify(bundle), before);
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
