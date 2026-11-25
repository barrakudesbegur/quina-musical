// Plan edits: rounds renumbered after every change, prize bundles (headline prizes first), sponsor ids and
// references, card prices, the schedule's local time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import {
  addPrize,
  addRound,
  blankPlan,
  blankRound,
  cardTypeChoices,
  isUnknownCardType,
  withRoundKind,
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
  assert.equal(plan.rounds[0].cardType, 'normal', "the round plays its kind's card type");
  assert.deepEqual([plan.rounds[0].line, plan.rounds[0].bingo], [[], []], 'no prizes yet');
  assert.equal(checkGamePlan(plan).ok, true);
  plan.rounds[0].bingo = addPrize(plan.rounds[0].bingo, true);
  assert.equal(checkGamePlan(plan).ok, false, 'empty prize titles are reported, not hidden');
  plan.rounds[0].bingo[0].title = 'Pernil';
  assert.equal(checkGamePlan(plan).ok, true);
});

// ---- a round's card type

const PRINTED = readPrintedCardTypes([
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: null },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: null },
  { type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: null },
]);

test("a new round plays its kind's default card type", () => {
  assert.equal(blankRound(1).cardType, 'normal');
  assert.equal(blankRound(2, 'special').cardType, 'especial');
  assert.equal(addRound([], 'special')[0].cardType, 'especial');
  assert.equal(checkGamePlan(blankPlan('26', 'Quina Musical', SAMPLE_PLAN.cheatSheet)).ok, true);
});

test("changing a round's kind moves its card type along only while it is the old kind's default", () => {
  const normal = blankRound(3);
  assert.equal(withRoundKind(normal, 'special').cardType, 'especial', 'normal cards → especial cards');
  assert.equal(withRoundKind(withRoundKind(normal, 'special'), 'normal').cardType, 'normal', 'and back');
  assert.equal(withRoundKind({ ...normal, cardType: 'desgraciat' }, 'special').cardType, 'desgraciat', 'a type picked on purpose stays');
  assert.equal(withRoundKind({ ...normal, kind: 'special', cardType: 'normal' }, 'normal').cardType, 'normal');
  const { cardType: _none, ...older } = normal;
  assert.equal(withRoundKind(older, 'special').cardType, 'especial', 'a round without one (an older plan) counts as the default');
  assert.equal(withRoundKind(normal, 'normal'), normal, 'the same kind changes nothing');
});

test("the card type picker offers card-types.json's types, plus the round's own when the list lacks it", () => {
  const types = PRINTED ?? [];
  assert.deepEqual(cardTypeChoices(types, 'normal'), ['normal', 'especial', 'desgraciat']);
  assert.deepEqual(cardTypeChoices(types, 'daurat'), ['normal', 'especial', 'desgraciat', 'daurat']);
  assert.deepEqual(cardTypeChoices([], 'especial'), ['especial'], 'no list at all: just what the plan says');
});

test('a round naming a type card-types.json lacks gets a warning; without the file nothing can be said', () => {
  assert.equal(isUnknownCardType('desgraciat', PRINTED), false);
  assert.equal(isUnknownCardType('daurat', PRINTED), true);
  assert.equal(isUnknownCardType('daurat', null), false);
});

test("a plan whose rounds name no card type still loads, and shows each kind's default", () => {
  const plan = structuredClone(SAMPLE_PLAN) as unknown as Record<string, unknown> & { rounds: Record<string, unknown>[] };
  for (const r of plan.rounds) delete r.cardType;
  const check = checkGamePlan(plan);
  assert.ok(check.ok);
  assert.deepEqual([check.plan.rounds[0].cardType, check.plan.rounds[6].cardType], ['normal', 'especial']);
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

test('planned breaks ("parón"): after any round but the last, once each; the planned end counts them', async () => {
  const { breakSlots, withBreak, withoutBreak, plannedEndMs, DEFAULT_BREAK_MINUTES } = await import('../../../../admin/logic/plan-edit.ts');
  const plan = { rounds: SAMPLE_PLAN.rounds, schedule: { startAtMs: 0, roundMinutes: 20, intervalMinutes: 3 } };
  const n = plan.rounds.length;
  assert.deepEqual(breakSlots(plan), Array.from({ length: n - 1 }, (_, i) => i + 1), 'never after the last round');
  const two = withBreak(withBreak(undefined, 4), 2, 10);
  assert.deepEqual(two, [{ afterRound: 2, minutes: 10 }, { afterRound: 4, minutes: DEFAULT_BREAK_MINUTES }], 'sorted by round');
  assert.deepEqual(withBreak(two, 2, 30).map((b) => b.minutes), [10, DEFAULT_BREAK_MINUTES], 'a round keeps its one break');
  assert.deepEqual(breakSlots({ ...plan, schedule: { ...plan.schedule, breaks: two } }).includes(2), false);
  assert.deepEqual(withoutBreak(two, 2), [{ afterRound: 4, minutes: DEFAULT_BREAK_MINUTES }]);
  assert.equal(withoutBreak([{ afterRound: 4, minutes: 5 }], 4), undefined, 'none left: the field goes, so the plan reads back unchanged');
  const base = plannedEndMs(plan)!;
  assert.equal(plannedEndMs({ ...plan, schedule: { ...plan.schedule, breaks: two } }), base + (10 + DEFAULT_BREAK_MINUTES) * 60_000);
});
