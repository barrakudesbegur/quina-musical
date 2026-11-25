// The Check on the projector: grid from the card, each step's state from its timestamps, and the failed result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_ROWS, cardTypeBadge, checkCells, checkReveal, firstMiss, gridKey, isFailed, plaqueSpot, resultX, stepMark, typeMarkAt, typeReveal, verdictOf, type CheckStepView } from '../../../../stage/model/check.ts';
import { checkResultDetail, nextRoundLabel, roundName, shortTypeName, STAGE_TEXT } from '../../../../stage/strings.ts';
import { UNKNOWN_CARD_TYPE_COLOR, knownCardTypes, readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';

const card = { id: 57, type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]] };
const steps: CheckStepView[] = [2, 62, 16, 20].map((songId, i) => ({ songId, landed: songId !== 20, atMs: 1000 + i * 3000, durationMs: 2500 }));
const title = (id: number) => `T${id}`;

test('the grid is the card, 3 × 4, with the played songs linked to their steps', () => {
  const cells = checkCells(card, steps, 2, title);
  assert.equal(cells.length, 12);
  assert.deepEqual(cells.slice(8).map((c) => [c.songId, c.row, c.col, c.step]), [[2, 2, 0, 0], [62, 2, 1, 1], [16, 2, 2, 2], [20, 2, 3, 3]]);
  assert.ok(cells.slice(0, 8).every((c) => c.step === null));
  assert.equal(cells[0].title, 'T5');
});

test('without the card (or a card that lacks the played songs): only the played songs', () => {
  for (const c of [null, { ...card, lines: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] }]) {
    const cells = checkCells(c, steps, 2, title);
    assert.deepEqual(cells.map((x) => [x.row, x.col, x.step]), [[2, 0, 0], [2, 1, 1], [2, 2, 2], [2, 3, 3]]);
  }
  const bingo = checkCells(null, [...steps, ...steps, ...steps], null, title);
  assert.deepEqual(bingo.map((x) => x.row), [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
});

test('a step plays from its time, and its mark stamps when the snippet ends', () => {
  const check = { steps, endAtMs: 13000, verdict: 'incomplete' as const };
  assert.deepEqual(checkReveal(check, 999).steps, ['pending', 'pending', 'pending', 'pending']);
  const playing = checkReveal(check, 1000);
  assert.deepEqual(playing.steps, ['playing', 'pending', 'pending', 'pending']);
  assert.equal(playing.playing, 0);
  assert.deepEqual(checkReveal(check, 3500).steps, ['landed', 'pending', 'pending', 'pending']);
  assert.equal(checkReveal(check, 3500).playing, null);
  assert.deepEqual(checkReveal(check, 12500).steps, ['landed', 'landed', 'landed', 'missed']);
  assert.equal(checkReveal(check, 12999).result, null);
  assert.equal(checkReveal(check, 13000).result, 'incomplete');
});

test('marking at the start is a setting', () => {
  const check = { steps, endAtMs: 13000, verdict: 'complete' as const };
  assert.deepEqual(checkReveal(check, 1000, 'start').steps, ['landed', 'pending', 'pending', 'pending']);
});

test('a card that is not valid shows its result at once', () => {
  assert.equal(checkReveal({ steps: [], endAtMs: 99999, verdict: 'notValid' }, 0).result, 'notValid');
  assert.equal(verdictOf('unknownCard'), 'notValid');
  assert.equal(verdictOf('wrongType'), 'notValid');
  assert.equal(verdictOf('complete'), 'complete');
  assert.equal(verdictOf('incomplete'), 'incomplete');
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
  const check = { steps, endAtMs: 13000, verdict: 'incomplete' as const };
  const reveal = checkReveal(check, check.endAtMs);
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
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: 200 },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: 300 },
  { type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: 100 },
]) ?? [];

test("the type badge takes the type's name and colour from card-types.json, and fails only for a wrong-type card", () => {
  assert.deepEqual(cardTypeBadge('normal', 'incomplete', TYPES, SAMPLE_PLAN), { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', special: false, ok: true });
  assert.deepEqual(cardTypeBadge('especial', 'wrongType', TYPES, SAMPLE_PLAN), { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', special: true, ok: false });
  assert.equal(cardTypeBadge(null, 'unknownCard', TYPES, SAMPLE_PLAN), null, 'an unknown card has no type');
  assert.equal(cardTypeBadge('desgraciat', 'complete', TYPES, SAMPLE_PLAN)?.ok, true, 'any type passes when the engine says it is the round\'s');
  // The star follows the plan's Quina Especial: here it plays the desgraciat cards.
  const plan = { rounds: SAMPLE_PLAN.rounds.map((r) => (r.kind === 'special' ? { ...r, cardType: 'desgraciat' } : r)) };
  assert.equal(cardTypeBadge('desgraciat', 'complete', TYPES, plan)?.special, true);
  assert.equal(cardTypeBadge('especial', 'wrongType', TYPES, plan)?.special, false);
});

test('the type badge without card-types.json: "Cartró <id>" in a neutral colour', () => {
  const bare = cardTypeBadge('especial', 'complete', knownCardTypes(null), null);
  assert.deepEqual(bare, { type: 'especial', label: 'Cartró especial', color: UNKNOWN_CARD_TYPE_COLOR, special: true, ok: true }, "no plan: the special round's default type gets the star");
  assert.equal(cardTypeBadge('rara', 'complete', TYPES, SAMPLE_PLAN)?.label, 'Cartró rara', 'a type nobody lists still shows');
  assert.equal(shortTypeName('Cartró normal'), 'Normal');
  assert.equal(shortTypeName('Cartró especial'), 'Especial');
  assert.equal(shortTypeName('Especial'), 'Especial');
});

test('the type is the first step: marked after the lead, never after the first snippet starts', () => {
  const cardType = cardTypeBadge('normal', 'incomplete', TYPES, null);
  const check = { startAtMs: 0, steps, cardType };
  assert.equal(typeMarkAt(check, 900), 900);
  assert.equal(typeMarkAt(check, 5000), steps[0].atMs, 'clamped to the first snippet');
  assert.equal(typeReveal(check, 899, 900), 'pending');
  assert.equal(typeReveal(check, 900, 900), 'ok');
  assert.equal(typeReveal({ ...check, cardType: null }, 900, 900), null, 'no badge for an unknown card');
});

test('a wrong-type card has no songs: its type fails at once, with the result', () => {
  const cardType = cardTypeBadge('especial', 'wrongType', TYPES, null);
  const check = { startAtMs: 5000, steps: [], cardType, endAtMs: 5000, verdict: verdictOf('wrongType') };
  assert.equal(typeReveal(check, 0, 900), 'wrong');
  assert.equal(checkReveal(check, 0).result, 'notValid');
});

test('the grid is redrawn within a Check only when its cells change (the catalog arriving late)', () => {
  const bare = gridKey(checkCells(null, steps, 2, () => null));
  assert.equal(bare, gridKey(checkCells(null, steps, 2, () => null)), 'same cells, same key');
  assert.notEqual(gridKey(checkCells(card, steps, 2, title)), bare, 'the whole card once the catalog is in');
  assert.notEqual(gridKey(checkCells(null, steps, 2, title)), bare, 'titles known later');
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
  assert.deepEqual(STAGE_TEXT.mark, { ok: '✓', last: '✓', bad: '✗' });
  // The shared win: a standing card that sat down with the last song; that song's tile passes, in gold.
  assert.equal(stepMark('standing', 'landed', 'fellLast'), 'last');
  assert.equal(stepMark('standing', 'missed', 'fellLast'), 'ok');
  assert.equal(stepMark('standing', 'landed', 'fallen'), 'bad');
  assert.equal(verdictOf('fellLast'), 'fellLast');
  assert.equal(isFailed('fellLast'), false, 'it passes');
  // The tile's words say what happened to the song, the same in every round.
  assert.deepEqual(STAGE_TEXT.markLabel, { landed: 'Ha sonat', missed: 'No ha sonat' });
});

test('a fallen card: the verdict, the song that sank it, and its words', () => {
  assert.equal(verdictOf('fallen'), 'fallen');
  assert.equal(isFailed('fallen'), true);
  const steps = standingSteps(6); // SUPERESTRELLA, row 2, 3rd song
  const cells = checkCells(card, steps, null, title);
  assert.equal(cells.length, 12);
  assert.deepEqual(cells.filter((c) => c.step === null).map((c) => c.songId), [69, 2, 62, 16, 20], 'the songs after it are never checked');
  const miss = firstMiss({ kind: 'standing', steps, cells });
  assert.deepEqual(miss, { step: 6, songId: 60, title: 'T60' });
  assert.equal(checkResultDetail('fallen', miss?.title ?? null), '«T60» ja ha sonat. El\u00a0joc\u00a0continua!');
  assert.equal(checkResultDetail('fallen', null), 'El\u00a0joc\u00a0continua!');
  assert.equal(STAGE_TEXT.checkResult.fallen, 'Cartró caigut');
  // A standing card that passed has no ✗.
  assert.equal(firstMiss({ kind: 'standing', steps: standingSteps(null), cells }), null);
  const reveal = checkReveal({ steps, endAtMs: 99999, verdict: 'fallen' }, 1000 + 6 * 900 + 2500);
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

test('the round names: "Quina Desgraciada", never with a number', () => {
  assert.equal(roundName({ number: 5, desgraciat: true }), 'Quina Desgraciada');
  assert.equal(roundName({ number: 5 }), 'Quina 5');
  assert.equal(nextRoundLabel({ number: 5, special: false, desgraciat: true }, 8), 'Següent: Quina Desgraciada');
  assert.equal(nextRoundLabel({ number: 5, special: false, desgraciat: false }, 8), 'Següent: Quina 5 de 8');
});
