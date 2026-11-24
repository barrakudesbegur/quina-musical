// The Check on the projector: grid from the card, each step's state from its timestamps, and the failed result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_ROWS, checkCells, checkReveal, firstMiss, gridKey, isFailed, plaqueSpot, verdictOf, type CheckStepView } from '../../../../stage/model/check.ts';
import { checkKindLabel, checkResultDetail, STAGE_TEXT } from '../../../../stage/strings.ts';

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

test('the ribbon\'s pill: the Line and its row counted from 1, or the Bingo', () => {
  assert.equal(checkKindLabel('line', 2), 'Línia · fila 3');
  assert.equal(checkKindLabel('line', 0), 'Línia · fila 1');
  assert.equal(checkKindLabel('line', null), 'Línia');
  assert.equal(checkKindLabel('bingo', null), 'Quina');
  assert.equal(STAGE_TEXT.checkedCard(57), 'Cartró 57');
  assert.equal(STAGE_TEXT.checkResult.incomplete, 'Aquest cartró no té premi');
});

test('the grid is redrawn within a Check only when its cells change (the catalog arriving late)', () => {
  const bare = gridKey(checkCells(null, steps, 2, () => null));
  assert.equal(bare, gridKey(checkCells(null, steps, 2, () => null)), 'same cells, same key');
  assert.notEqual(gridKey(checkCells(card, steps, 2, title)), bare, 'the whole card once the catalog is in');
  assert.notEqual(gridKey(checkCells(null, steps, 2, title)), bare, 'titles known later');
});
