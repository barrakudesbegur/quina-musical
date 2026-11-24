// The Check on the projector: grid from the card, and each step's state from its timestamps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCells, checkReveal, verdictOf, type CheckStepView } from '../../../../stage/model/check.ts';

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
