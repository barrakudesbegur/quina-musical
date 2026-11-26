// The Check on the projector, paced by the presenters: grid from the card, each revealed song's state from its
// timestamps, the result only from the cue, a review, a step back, and the failed result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CheckInfo, ClaimInfo, ClaimStatus } from '@quina/protocol';
import {
  CARD_ROWS,
  cardTypeBadge,
  checkCells,
  checkReveal,
  checkTypeOk,
  firstMiss,
  gridKey,
  isFailed,
  plaqueSpot,
  readCheck,
  resultX,
  shownCheck,
  stepMark,
  typeMarkAt,
  typeReveal,
  verdictOf,
  type CheckStepView,
  type CheckVerdict,
} from '../../../../stage/model/check.ts';
import { checkResultDetail, nextRoundLabel, STAGE_TEXT } from '../../../../stage/strings.ts';
import { UNKNOWN_CARD_TYPE_COLOR, knownCardTypes, readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';

const card = { id: 57, type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]] };
const steps: CheckStepView[] = [2, 62, 16, 20].map((songId, i) => ({ songId, landed: songId !== 20, atMs: 1000 + i * 3000, durationMs: 2500 }));
const title = (id: number) => `T${id}`;
/** What checkReveal reads, revealing `steps` (not under review, no step back) with the result `verdict`. */
const revealOf = (revealed: CheckStepView[], verdict: CheckVerdict | null = null) => ({ steps: revealed, verdict, reviewing: false, reviewSinceMs: null, replay: null });

test('the grid is the card, 3 × 4, each song of the row linked to its place in the reveal order', () => {
  for (const revealed of [steps, steps.slice(0, 2), []]) {
    const cells = checkCells(card, revealed, 2, title);
    assert.equal(cells.length, 12);
    assert.deepEqual(cells.slice(8).map((c) => [c.songId, c.row, c.col, c.step]), [[2, 2, 0, 0], [62, 2, 1, 1], [16, 2, 2, 2], [20, 2, 3, 3]], 'the same grid whatever is revealed');
    assert.ok(cells.slice(0, 8).every((c) => c.step === null));
    assert.equal(cells[0].title, 'T5');
  }
  assert.equal(gridKey(checkCells(card, [], 2, title)), gridKey(checkCells(card, steps, 2, title)), 'a reveal never redraws the grid');
  const bingo = checkCells(card, [], null, title);
  assert.deepEqual(bingo.map((c) => c.step), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'a Bingo or a standing claim: card order');
});

test('without the card (or a card that lacks the revealed songs): only the revealed songs', () => {
  for (const c of [null, { ...card, lines: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] }]) {
    const cells = checkCells(c, steps, 2, title);
    assert.deepEqual(cells.map((x) => [x.row, x.col, x.step]), [[2, 0, 0], [2, 1, 1], [2, 2, 2], [2, 3, 3]]);
  }
  assert.deepEqual(checkCells(null, [], 2, title), [], 'nothing revealed, nothing known');
  const bingo = checkCells(null, [...steps, ...steps, ...steps], null, title);
  assert.deepEqual(bingo.map((x) => x.row), [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
});

test('a revealed song plays from its time, and its mark stamps when the snippet ends; no result before the cue', () => {
  assert.deepEqual(checkReveal(revealOf(steps), 999).steps, ['pending', 'pending', 'pending', 'pending']);
  const playing = checkReveal(revealOf(steps), 1000);
  assert.deepEqual(playing.steps, ['playing', 'pending', 'pending', 'pending']);
  assert.equal(playing.playing, 0);
  assert.deepEqual(checkReveal(revealOf(steps), 3500).steps, ['landed', 'pending', 'pending', 'pending']);
  assert.equal(checkReveal(revealOf(steps), 3500).playing, null);
  assert.deepEqual(checkReveal(revealOf(steps), 12500).steps, ['landed', 'landed', 'landed', 'missed']);
  assert.equal(checkReveal(revealOf(steps), 99999).result, null, 'every song marked, still no result: it waits for the cue');
  assert.equal(checkReveal(revealOf(steps, 'incomplete'), 12500).result, 'incomplete');
  assert.deepEqual(checkReveal(revealOf(steps, 'incomplete'), 10000).steps, ['landed', 'landed', 'landed', 'missed'], 'at the cue every mark shows');
  assert.deepEqual(checkReveal(revealOf([]), 0), { steps: [], playing: null, replaying: null, result: null });
});

test('marking at the start is a setting', () => {
  assert.deepEqual(checkReveal(revealOf(steps), 1000, 'start').steps, ['landed', 'pending', 'pending', 'pending']);
});

test('the result comes from the cue only; the finding just shapes its look', () => {
  for (const outcome of ['complete', 'incomplete', 'wrongType', 'fallen', 'fellLast'] as const) assert.equal(verdictOf(outcome, null, 'line'), null, outcome);
  assert.equal(verdictOf('complete', 'pass', 'line'), 'complete');
  assert.equal(verdictOf('incomplete', 'fail', 'line'), 'incomplete');
  assert.equal(verdictOf('wrongType', 'fail', 'line'), 'notValid');
  assert.equal(verdictOf('unknownCard', 'fail', 'bingo'), 'notValid');
  assert.equal(verdictOf('fallen', 'fail', 'standing'), 'fallen');
  // A Review decided by hand, against the card (D121): the cue is what shows.
  assert.equal(verdictOf('incomplete', 'pass', 'line'), 'complete', 'won by hand');
  assert.equal(verdictOf('complete', 'fail', 'bingo'), 'incomplete', 'lost by hand');
  assert.equal(verdictOf('complete', 'fail', 'standing'), 'fallen');
});

test('under review the marks stay as the room saw them, and no ring plays; a step back replays the song before', () => {
  // Under review from 2000: «All Night»'s snippet (1000–3500) was playing, so it isn't marked.
  const reviewing = { ...revealOf(steps.slice(0, 1)), reviewing: true, reviewSinceMs: 2000 };
  assert.deepEqual(checkReveal(reviewing, 9000), { steps: ['pending'], playing: null, replaying: null, result: null });
  assert.deepEqual(checkReveal({ ...reviewing, reviewSinceMs: 4000 }, 9000).steps, ['landed'], 'one marked before stays');
  assert.deepEqual(checkReveal({ ...reviewing, reviewSinceMs: null }, 9000).steps, ['landed'], 'joined mid-review: as the clock says');
  assert.equal(checkReveal({ ...reviewing, reviewSinceMs: null }, 2000).playing, null, 'no ring under review');
  // The Check goes on: the mark shows.
  assert.deepEqual(checkReveal(revealOf(steps.slice(0, 1)), 9000).steps, ['landed']);
  // A step back took the 2nd mark off at 8000: the 1st song's snippet replays under its equaliser, its mark stays.
  const back = { ...revealOf(steps.slice(0, 1)), replay: { step: 0, fromMs: 8000, toMs: 10500 } };
  assert.deepEqual(checkReveal(back, 9000), { steps: ['landed'], playing: null, replaying: 0, result: null });
  assert.equal(checkReveal(back, 10500).replaying, null, 'over');
  assert.equal(checkReveal({ ...back, reviewing: true }, 9000).replaying, null);
});

// ---- the failed Check: which song it names, which tile is marked ✗, where the plaque goes, what it says

test('a failed Check names the first song that didn\'t sound, from its tile', () => {
  const cells = checkCells(card, steps, 2, title);
  const miss = firstMiss({ steps, cells });
  assert.deepEqual(miss, { step: 3, songId: 20, title: 'T20' });
  assert.equal(checkResultDetail('incomplete', miss?.title ?? null), 'Falta «T20». El\u00a0joc\u00a0continua!');
});

test('the named song\'s tile is the one marked missed, the others landed', () => {
  const cells = checkCells(card, steps, 2, title);
  const reveal = checkReveal(revealOf(steps, 'incomplete'), 13000);
  const miss = firstMiss({ steps, cells });
  assert.ok(miss);
  const tile = cells.find((c) => c.step === miss.step);
  assert.deepEqual(tile && [tile.songId, tile.row, tile.col], [20, 2, 3]);
  assert.equal(reveal.steps[miss.step], 'missed');
  assert.deepEqual(reveal.steps.filter((_, i) => i !== miss.step), ['landed', 'landed', 'landed']);
  assert.equal(reveal.result, 'incomplete');
  assert.equal(isFailed('incomplete'), true);
});

test('with several songs missing, the first one played is named', () => {
  const twoMissing = steps.map((s) => ({ ...s, landed: s.songId === 2 || s.songId === 16 }));
  assert.deepEqual(firstMiss({ steps: twoMissing, cells: checkCells(card, twoMissing, 2, title) }), { step: 1, songId: 62, title: 'T62' });
});

test('a missing song whose title isn\'t known is not named: just "El joc continua!"', () => {
  const unknown = () => null;
  const miss = firstMiss({ steps, cells: checkCells(null, steps, 2, unknown) });
  assert.deepEqual(miss, { step: 3, songId: 20, title: null });
  assert.equal(checkResultDetail('incomplete', null), 'El\u00a0joc\u00a0continua!');
});

test('a valid Check names nothing and has no second line; a card that is not valid just goes on', () => {
  const allLanded = steps.map((s) => ({ ...s, landed: true }));
  assert.equal(firstMiss({ steps: allLanded, cells: checkCells(card, allLanded, 2, title) }), null);
  assert.equal(isFailed('complete'), false);
  assert.equal(checkResultDetail('complete', 'T20'), null);
  assert.equal(isFailed('notValid'), true);
  assert.equal(checkResultDetail('notValid', 'T20'), 'El\u00a0joc\u00a0continua!');
  assert.equal(firstMiss({ steps: [], cells: [] }), null);
});

test('the plaque covers a Line\'s other rows, never the checked one', () => {
  const cells = checkCells(card, steps, 2, title);
  const at = (row: number) => plaqueSpot({ row, cells });
  assert.deepEqual(at(2), { at: 1 / 3, over: 'rows' }, 'bottom row checked: over the top two');
  assert.deepEqual(at(0), { at: 2 / 3, over: 'rows' }, 'top row checked: over the bottom two');
  assert.deepEqual(at(1), { at: 2.5 / 3, over: 'row' }, 'middle row checked: over the bottom one, compact');
  for (const row of [0, 1, 2]) {
    const { at: centre } = at(row);
    assert.ok(Math.floor(centre * CARD_ROWS) !== row, `row ${row} stays clear`);
  }
});

test('a Bingo\'s plaque, or one with no grid, sits over the middle of the card', () => {
  const cells = checkCells(card, [...steps], null, title);
  assert.deepEqual(plaqueSpot({ row: null, cells }), { at: 0.5, over: 'card' });
  assert.deepEqual(plaqueSpot({ row: 2, cells: [] }), { at: 0.5, over: 'card' });
});

test('the plate names the card being checked; the result plaque\'s words', () => {
  assert.equal(STAGE_TEXT.checkPlate(57), 'Cartró #57');
  assert.equal(STAGE_TEXT.checkResult.incomplete, 'Aquest cartró no té premi');
  assert.equal(STAGE_TEXT.checkResult.complete, 'Cartró correcte!');
});

// ---- the card-type step: the badge, and when it gets its mark

const TYPES = readPrintedCardTypes([
  { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: '', priceCents: 200, sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: 300 },
  { type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: 100 },
]) ?? [];

test("the type badge: the type and the side checked in one label (D163), its colour from card-types.json, its mark as the Check tells it", () => {
  assert.deepEqual(cardTypeBadge('normal', 1, true, TYPES, SAMPLE_PLAN), { type: 'normal', label: 'Normal 1–5', color: '#cfe8ff', special: false, ok: true });
  assert.equal(cardTypeBadge('normal', 2, true, TYPES, SAMPLE_PLAN)?.label, 'Normal 6–10');
  assert.deepEqual(cardTypeBadge('especial', 1, false, TYPES, SAMPLE_PLAN), { type: 'especial', label: 'Especial', color: '#ffd9e8', special: true, ok: false });
  assert.equal(cardTypeBadge('especial', 2, false, TYPES, SAMPLE_PLAN)?.label, 'Especial', 'a one-sided type: no side in its label');
  assert.equal(cardTypeBadge(null, 1, null, TYPES, SAMPLE_PLAN), null, 'an unknown card has no type');
  // The star follows the plan's Quina Especial: here it plays the desgraciat cards.
  const plan = { rounds: SAMPLE_PLAN.rounds.map((r) => (r.kind === 'special' ? { ...r, cardType: 'desgraciat' } : r)) };
  assert.equal(cardTypeBadge('desgraciat', 1, true, TYPES, plan)?.special, true);
  assert.equal(cardTypeBadge('especial', 1, false, TYPES, plan)?.special, false);
});

test("the type's mark from public facts: a Check with songs to reveal is of the round's type; one with none, at its cue", () => {
  assert.equal(checkTypeOk({ total: 4, cue: null }), true);
  assert.equal(checkTypeOk({ total: 12, cue: 'fail' }), true);
  assert.equal(checkTypeOk({ total: 0, cue: null }), null, 'the wrong type: nothing says it before the cue');
  assert.equal(checkTypeOk({ total: 0, cue: 'fail' }), false);
  assert.equal(checkTypeOk({ total: 0, cue: 'pass' }), true, 'won by hand from a review');
});

test('the type badge without card-types.json: its id as a name, in a neutral colour', () => {
  const bare = cardTypeBadge('especial', 1, true, knownCardTypes(null), null);
  assert.deepEqual(bare, { type: 'especial', label: 'Especial', color: UNKNOWN_CARD_TYPE_COLOR, special: true, ok: true }, "no plan: the special round's default type gets the star");
  assert.equal(cardTypeBadge('rara', 2, true, TYPES, SAMPLE_PLAN)?.label, 'Rara', 'a type nobody lists still shows');
});

test('the type is the first step: marked after the lead, never after the first song is revealed', () => {
  const cardType = cardTypeBadge('normal', 1, true, TYPES, null);
  const check = { startAtMs: 0, steps, cardType };
  assert.equal(typeMarkAt(check, 900), 900);
  assert.equal(typeMarkAt(check, 5000), steps[0].atMs, 'clamped to the first reveal');
  assert.equal(typeMarkAt({ ...check, steps: [] }, 5000), 5000, 'nothing revealed yet: the lead');
  assert.equal(typeReveal(check, 899, 900), 'pending');
  assert.equal(typeReveal(check, 900, 900), 'ok');
  assert.equal(typeReveal({ ...check, cardType: null }, 900, 900), null, 'no badge for an unknown card');
});

test('a wrong-type card has no songs: its type fails at its cue, with the result, and not before', () => {
  const before = { startAtMs: 0, steps: [], cardType: cardTypeBadge('especial', 1, checkTypeOk({ total: 0, cue: null }), TYPES, null) };
  assert.equal(typeReveal(before, 99999, 900), 'pending');
  const cued = { ...before, cardType: cardTypeBadge('especial', 1, checkTypeOk({ total: 0, cue: 'fail' }), TYPES, null) };
  assert.equal(typeReveal(cued, 0, 900), 'wrong');
  assert.equal(checkReveal(revealOf([], verdictOf('wrongType', 'fail', 'line')), 0).result, 'notValid');
});

test('the grid is redrawn within a Check only when its cells change (the catalog arriving late)', () => {
  const bare = gridKey(checkCells(null, steps, 2, () => null));
  assert.equal(bare, gridKey(checkCells(null, steps, 2, () => null)), 'same cells, same key');
  assert.notEqual(gridKey(checkCells(card, steps, 2, title)), bare, 'the whole card once the catalog is in');
  assert.notEqual(gridKey(checkCells(null, steps, 2, title)), bare, 'titles known later');
  assert.notEqual(gridKey(checkCells(null, steps.slice(0, 3), 2, () => null)), bare, 'without the catalog, each reveal adds a cell');
});

// ---- the Desgraciat round's standing Check

/** #57's 12 songs in card order, checked up to `sankAt` (that song landed), as the engine schedules them. */
const standingSteps = (sankAt: number | null): CheckStepView[] =>
  card.lines
    .flat()
    .slice(0, sankAt === null ? 12 : sankAt + 1)
    .map((songId, i) => ({ songId, landed: i === sankAt, atMs: 1000 + i * 900, durationMs: i === sankAt ? 2500 : 550 }));

test("a standing Check's marks mean good for the claim: ✓ for a song that hasn't sounded, ✗ for one that has", () => {
  assert.equal(stepMark('standing', 'missed'), 'ok');
  assert.equal(stepMark('standing', 'landed'), 'bad');
  assert.equal(stepMark('bingo', 'landed'), 'ok');
  assert.equal(stepMark('line', 'missed'), 'bad');
  assert.equal(stepMark('standing', 'playing'), null);
  assert.equal(stepMark('line', 'pending'), null);
  assert.deepEqual(STAGE_TEXT.mark, { ok: '✓', bad: '✗' });
  // No shared win (D180): a standing card's landed song is its ✗; only a pass is a valid card.
  assert.equal(verdictOf('fallen', 'pass', 'standing'), 'complete', 'won by hand');
  assert.equal(isFailed('fallen'), true);
  // The tile's words say what happened to the song, the same in every round.
  assert.deepEqual(STAGE_TEXT.markLabel, { landed: 'Ha sonat', missed: 'No ha sonat' });
});

test('a fallen card: the verdict, the song that sank it, and its words', () => {
  assert.equal(verdictOf('fallen', 'fail', 'standing'), 'fallen');
  assert.equal(isFailed('fallen'), true);
  const steps = standingSteps(6); // SUPERESTRELLA, row 2, 3rd song
  const cells = checkCells(card, steps, null, title);
  assert.equal(cells.length, 12);
  assert.deepEqual(cells.filter((c) => (c.step ?? 99) >= steps.length).map((c) => c.songId), [69, 2, 62, 16, 20], 'the songs after it are never revealed');
  const miss = firstMiss({ kind: 'standing', steps, cells });
  assert.deepEqual(miss, { step: 6, songId: 60, title: 'T60' });
  assert.equal(checkResultDetail('fallen', miss?.title ?? null), '«T60» ja ha sonat. El\u00a0joc\u00a0continua!');
  assert.equal(checkResultDetail('fallen', null), 'El\u00a0joc\u00a0continua!');
  assert.equal(STAGE_TEXT.checkResult.fallen, 'Cartró caigut');
  // A standing card that passed has no ✗.
  assert.equal(firstMiss({ kind: 'standing', steps: standingSteps(null), cells }), null);
  const reveal = checkReveal(revealOf(steps), 1000 + 6 * 900 + 2500);
  assert.deepEqual(reveal.steps, ['missed', 'missed', 'missed', 'missed', 'missed', 'missed', 'landed']);
});

test("a fallen card's ✗ lands over the half of the card away from the song that sank it", () => {
  const x = (sankAt: number) => {
    const steps = standingSteps(sankAt);
    return resultX({ kind: 'standing', verdict: 'fallen', steps, cells: checkCells(card, steps, null, title) });
  };
  assert.equal(x(6), 0.25, '3rd column: the ✗ on the left half');
  assert.equal(x(3), 0.25, '4th column');
  assert.equal(x(4), 0.75, '1st column: the right half');
  assert.equal(x(9), 0.75, '2nd column');
  const steps = standingSteps(6);
  const cells = checkCells(card, steps, null, title);
  assert.equal(resultX({ kind: 'standing', verdict: 'complete', steps: standingSteps(null), cells }), 0.5, 'a valid card: the middle');
  assert.equal(resultX({ kind: 'bingo', verdict: 'incomplete', steps, cells }), 0.5);
  assert.deepEqual(plaqueSpot({ row: null, cells }), { at: 0.5, over: 'card' });
});

test('the round names: "Quina Desgraciada", never with a number; the normal rounds after it count one less', () => {
  assert.equal(nextRoundLabel({ number: 5, kind: 'desgraciat' }, SAMPLE_PLAN, 8), 'Següent: Quina Desgraciada');
  assert.equal(nextRoundLabel({ number: 5, kind: 'normal' }, null, 8), 'Següent: Quina 5 de 8', 'no plan: the plan number');
  assert.equal(nextRoundLabel({ number: 6, kind: 'normal' }, SAMPLE_PLAN, 8), 'Següent: Quina 5 de 8');
});

// ---- what the stage keeps between snapshots: odd snapshots, the last card's fail, a discard

const info = (patch: Partial<CheckInfo> = {}): CheckInfo => ({
  claimId: 'cl-5',
  cardId: 57,
  kind: 'line',
  outcome: 'incomplete',
  row: 2,
  otherRows: [],
  cardType: 'normal',
  startAtMs: 0,
  total: 4,
  revealed: steps,
  auto: false,
  cue: null,
  reviewing: false,
  ...patch,
});
/** The Claim of `info()` with a status (only what shownCheck reads). */
const claim = (status: ClaimStatus) => ({ claimId: 'cl-5', status }) as ClaimInfo;

test('an odd snapshot draws as a Check with nothing revealed, never a crash', () => {
  const odd = readCheck({ claimId: 'cl-1', cardId: 9, kind: 'line', outcome: 'complete', row: 0, startAtMs: 0 } as unknown as CheckInfo);
  assert.deepEqual([odd.revealed, odd.total, odd.cue, odd.reviewing, odd.otherRows], [[], 0, null, false, []]);
  const older = readCheck({ ...info(), revealed: undefined, steps: steps, endAtMs: 9 } as unknown as CheckInfo);
  assert.deepEqual(older.revealed, []);
});

test('the Check on screen is drawn as it is', () => {
  const flow = { scene: 'check' as const, check: info(), claims: [] };
  assert.deepEqual(shownCheck(flow, 'claim', null), { check: info(), discarded: false });
  assert.equal(shownCheck({ scene: 'play', check: null, claims: [] }, null, info()), null, 'nothing kept by default');
});

test("the last card's fail stays on screen through the round's `checkFailed` Hold, with its cue", () => {
  const flow = { scene: 'play' as const, check: null, claims: [claim('invalid')] };
  const kept = shownCheck(flow, 'checkFailed', info());
  assert.equal(kept?.check.cue, 'fail');
  assert.equal(kept?.discarded, false);
  assert.equal(shownCheck(flow, 'hold', info()), null, 'the Hold ended (another one now)');
  assert.equal(shownCheck(flow, null, info()), null, 'Next: back to the round');
  assert.equal(shownCheck({ ...flow, claims: [claim('valid')] }, 'checkFailed', info()), null, 'not that card');
  assert.equal(shownCheck({ ...flow, claims: [] }, 'checkFailed', info()), null, 'another round');
});

test('a Check discarded from its review fades out while the next card is on its way', () => {
  const kept = shownCheck({ scene: 'check', check: null, claims: [claim('discarded')] }, 'claim', info({ reviewing: true }));
  assert.equal(kept?.discarded, true);
  assert.equal(shownCheck({ scene: 'check', check: null, claims: [claim('queued')] }, 'back', info()), null, 'a Back puts it back in the queue: it goes');
});
