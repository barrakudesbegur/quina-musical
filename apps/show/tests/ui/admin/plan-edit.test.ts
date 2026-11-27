// Plan edits: rounds renumbered after every change, prize bundles (headline prizes first), sponsor ids and
// references, card prices, the schedule's local time, the doors' time and the planned Throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan, quinaNumber } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import { S } from '../../../../admin/strings.ts';
import {
  addPrize,
  addRound,
  blankPlan,
  blankRound,
  cardTypeChoices,
  defaultSide,
  isUnknownCardType,
  sideChoices,
  withCardType,
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

// ---- a round's side (D101, D102, D171, D226)

const SIDED = readPrintedCardTypes([
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: null, sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: null, sides: [{ side: 1, pool: '1', label: 'Desgraciada' }, { side: 2, pool: '2', label: 'Quina Especial' }] },
  { type: 'daurat', name: 'Cartró daurat', color: '#f5d77a', title: '', priceCents: null, sides: [{ side: 1, pool: '1' }] },
]) ?? [];

test('the side a round plays by default (D193, D226): the first five normal rounds side 1, the rest side 2; the Desgraciat side 1, the Especial side 2', () => {
  type R = { number: number; kind: 'normal' | 'special' | 'desgraciat' };
  const sides = (rounds: R[], types = SIDED) => rounds.map((r) => defaultSide(r, rounds, types));
  const n = (number: number) => ({ number, kind: 'normal' as const });
  assert.deepEqual(sides([1, 2, 3, 4, 5, 6, 7, 8].map(n)), [1, 1, 1, 1, 1, 2, 2, 2]);
  // The specials have no Quina number, so they don't count: 2025's order put the Desgraciat fourth, so plan round 6 is
  // Quina 5, still on side 1, and plan round 8 is Quina 6, on side 2.
  const order2025: R[] = [n(1), n(2), n(3), { number: 4, kind: 'desgraciat' }, n(5), n(6), { number: 7, kind: 'special' }, n(8)];
  assert.deepEqual(sides(order2025), [1, 1, 1, 1, 1, 1, 2, 2]);
  assert.deepEqual(order2025.map((r) => quinaNumber(r, order2025)), [1, 2, 3, null, 4, 5, null, 6]);
  assert.deepEqual(SAMPLE_PLAN.rounds.map((r) => defaultSide(r, SAMPLE_PLAN.rounds, SIDED)), [1, 1, 1, 1, 1, 1, 2, 2]);
  assert.deepEqual(SAMPLE_PLAN.rounds.map((r) => r.side), [1, 1, 1, 1, 1, 1, 2, 2], 'and it follows them');
  // The especial card plays both specials (D81): the Desgraciat its side 1, the Especial its side 2, in any order.
  assert.deepEqual(sides([{ number: 6, kind: 'special' }, { number: 11, kind: 'desgraciat' }]), [2, 1]);
  assert.equal(defaultSide({ number: 7, kind: 'special', cardType: 'daurat' }, [], SIDED), 1, 'an Especial on a one-sided type: its first side');
  assert.equal(defaultSide({ number: 7, kind: 'special' }, [], []), 2, 'without card-types.json: side 2 too');
  const five = [1, 2, 3, 4, 5, 6].map(n);
  assert.equal(defaultSide({ number: 6, kind: 'normal', cardType: 'daurat' }, five, SIDED), 1, 'a one-sided type plays its side');
  assert.equal(defaultSide({ number: 6, kind: 'normal', cardType: 'especial' }, five, SIDED), 2, 'Quina 6 on the especial card: its side 2');
  assert.equal(defaultSide(n(6), five, []), 2, "without card-types.json: D171's side");
  assert.deepEqual(addRound(addRound(addRound(addRound(addRound([], 'normal', SIDED), 'normal', SIDED), 'normal', SIDED), 'normal', SIDED), 'normal', SIDED).map((r) => r.side), [1, 1, 1, 1, 1]);
  assert.equal(blankRound(6, 'desgraciat', SIDED).side, 1);
  assert.equal(blankRound(7, 'special', SIDED).side, 2);
  assert.deepEqual(addRound(addRound([], 'desgraciat', SIDED), 'special', SIDED).map((r) => [r.cardType, r.side]), [['especial', 1], ['especial', 2]]);
});

test("the side picker offers the type's sides; a new type keeps the side when it has it; a new kind moves a default side along", () => {
  assert.deepEqual(sideChoices(SIDED, 'normal', 1), [{ side: 1, label: '1–5' }, { side: 2, label: '6–10' }]);
  assert.deepEqual(sideChoices(SIDED, 'especial', 2), [{ side: 1, label: 'Desgraciada' }, { side: 2, label: 'Quina Especial' }]);
  assert.deepEqual(sideChoices(SIDED, 'daurat', 2), [{ side: 1, label: null }, { side: 2, label: null }], "the plan's side stays shown, next to its warning");
  assert.deepEqual(sideChoices([], 'normal', 1), [{ side: 1, label: null }], 'without card-types.json');
  const named = (type: string) => sideChoices(SIDED, type, 1).map((c) => S.rounds.sideOption(c.side, c.label));
  assert.deepEqual(named('normal'), ['Cara 1 · Quines 1–5', 'Cara 2 · Quines 6–10'], 'a range: the Quines it is printed for');
  assert.deepEqual(named('especial'), ['Cara 1 · Desgraciada', 'Cara 2 · Quina Especial'], "D226: a round's name as it is");
  assert.deepEqual(named('daurat'), ['Cara 1'], 'no label: just the side');
  // Five normal rounds before it: the sixth is Quina 6, on side 2.
  const before = [1, 2, 3, 4, 5].map((n) => blankRound(n, 'normal', SIDED));
  const six = blankRound(6, 'normal', SIDED, before);
  const plan = [...before, six];
  assert.equal(six.side, 2);
  assert.equal(blankRound(6, 'normal', SIDED).side, 1, 'with no rounds before it, it is Quina 1');
  assert.equal(withCardType(six, 'daurat', SIDED, plan).side, 1, 'a one-sided card has no side 2');
  assert.equal(withCardType(six, 'especial', SIDED, plan).side, 2, 'the especial card has one');
  assert.equal(withCardType({ ...six, side: 1 }, 'normal', SIDED, plan).side, 1, 'a side the type has stays');
  const three = blankRound(3, 'normal', SIDED);
  assert.equal(withRoundKind(three, 'special', SIDED).side, 2, 'side 1 was the default: the Especial plays side 2');
  assert.equal(withRoundKind(withRoundKind(three, 'special', SIDED), 'normal', SIDED).side, 1, 'and back');
  assert.equal(withRoundKind(withRoundKind(three, 'special', SIDED), 'desgraciat', SIDED).side, 1, 'the Especial made the Desgraciat: side 1');
  assert.equal(withRoundKind({ ...three, side: 1 }, 'special', SIDED).cardType, 'especial');
  assert.equal(withRoundKind({ ...three, side: 2, cardType: 'daurat' }, 'special', SIDED).side, 1, "a side the round's card type lacks: its default");
  // An Especial after five normal rounds, on the normal card's side 1 by hand: made normal, it is Quina 6 (default side 2).
  const picked = { ...blankRound(6, 'special', SIDED, before), cardType: 'normal', side: 1 };
  assert.equal(withRoundKind(picked, 'normal', SIDED, [...before, picked]).side, 1, 'a side picked on purpose stays while its card type has it');
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

test('planned Throws (D136): after any round but the last, once each; the planned end counts each one\'s break in place of its Interval (D192)', async () => {
  const { throwSlots, withThrow, withoutThrow, plannedEndMs, DEFAULT_THROW_MINUTES } = await import('../../../../admin/logic/plan-edit.ts');
  const plan = { rounds: SAMPLE_PLAN.rounds, schedule: { startAtMs: 0, roundMinutes: 20, intervalMinutes: 3 } };
  const n = plan.rounds.length;
  assert.deepEqual(throwSlots(plan), Array.from({ length: n - 1 }, (_, i) => i + 1), 'never after the last round');
  const two = withThrow(withThrow(undefined, 4), 2, 10);
  assert.deepEqual(two, [{ afterRound: 2, minutes: 10 }, { afterRound: 4, minutes: DEFAULT_THROW_MINUTES }], 'sorted by round');
  assert.deepEqual(withThrow(two, 2, 30).map((t) => t.minutes), [10, DEFAULT_THROW_MINUTES], 'a round keeps its one Throw');
  assert.deepEqual(throwSlots({ ...plan, schedule: { ...plan.schedule, throws: two } }).includes(2), false);
  assert.deepEqual(withoutThrow(two, 2), [{ afterRound: 4, minutes: DEFAULT_THROW_MINUTES }]);
  assert.equal(withoutThrow([{ afterRound: 4, minutes: 5 }], 4), undefined, 'none left: the field goes, so the plan reads back unchanged');
  const base = plannedEndMs(plan)!;
  assert.equal(plannedEndMs({ ...plan, schedule: { ...plan.schedule, throws: two } }), base + (10 - 3 + (DEFAULT_THROW_MINUTES - 3)) * 60_000);
  assert.equal(DEFAULT_THROW_MINUTES, 10, "the organizers' «Descans + llançament (10 min)»");
});

test("the doors' time (D150): optional, never after the first round's start, as checkGamePlan says", async () => {
  const { doorsAfterStart } = await import('../../../../admin/logic/plan-edit.ts');
  const start = new Date(2026, 11, 26, 18, 30).getTime();
  const at = (doorsAtMs: number | undefined, startAtMs: number | null) => ({ ...(doorsAtMs === undefined ? {} : { doorsAtMs }), startAtMs });
  assert.equal(doorsAfterStart(at(start - 30 * 60_000, start)), false, 'half an hour before');
  assert.equal(doorsAfterStart(at(start, start)), false, 'at the start itself');
  assert.equal(doorsAfterStart(at(start + 60_000, start)), true, 'a minute after');
  assert.equal(doorsAfterStart(at(undefined, start)), false, 'no doors time');
  assert.equal(doorsAfterStart(at(start + 60_000, null)), false, 'no start time to be after');
  for (const doorsAtMs of [start - 60_000, start + 60_000]) {
    const check = checkGamePlan({ ...SAMPLE_PLAN, schedule: { ...SAMPLE_PLAN.schedule, startAtMs: start, doorsAtMs } });
    assert.equal(check.ok, !doorsAfterStart(at(doorsAtMs, start)), 'the field agrees with the plan check');
  }
});
