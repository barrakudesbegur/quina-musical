// The Check (game/check.ts): outcomes, the row a Line plays, when the card completed, warnings, and timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCheck, timeCheck, type CheckInput } from '../engine/src/game/check.ts';
import { FLOW } from '../engine/src/config.ts';
import type { Card } from '../engine/src/game/cards.ts';

// Song ids are plain numbers here. Card 1: rows 1-4, 5-8, 9-12. Card 2: the same songs, rows in another order.
const normal: Card = { id: 1, type: 'normal', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] };
const other: Card = { id: 2, type: 'normal', lines: [[9, 10, 11, 12], [1, 2, 3, 4], [5, 6, 7, 8]] };
const special: Card = { id: 400, type: 'especial', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] };
const allCards = [normal, other, special];

/** A Check on `queue` after its first `landed` songs have landed. */
function check(cardId: number, queue: number[], landed: number, over: Partial<CheckInput> = {}) {
  return computeCheck({ allCards, cardId, kind: 'line', roundKind: 'normal', cardsInPlay: new Set([1, 2, 400]), queue, position: landed - 1, ...over });
}

test('a number outside the generated cards, or of the wrong type for the round, has no steps', () => {
  assert.deepEqual(check(9999, [1, 2, 3, 4], 4), { outcome: 'unknownCard', row: null, otherRows: [], steps: [], completeSince: null, warnings: [] });
  const wrong = check(400, [1, 2, 3, 4], 4);
  assert.equal(wrong.outcome, 'wrongType');
  assert.deepEqual(wrong.steps, []);
  assert.equal(check(1, [1, 2, 3, 4], 4, { roundKind: 'special' }).outcome, 'wrongType', 'a normal card in the special round');
  assert.equal(check(400, [1, 2, 3, 4], 4, { roundKind: 'special' }).outcome, 'complete');
});

test('a card not among the cards in play is only a warning: its Check still runs', () => {
  const r = check(1, [1, 2, 3, 4], 4, { cardsInPlay: new Set([2]) });
  assert.deepEqual(r.warnings, ['notSold']);
  assert.equal(r.outcome, 'complete');
  assert.equal(r.steps.length, 4);
  assert.deepEqual(check(9999, [1], 1, { cardsInPlay: new Set() }).warnings, [], 'an unknown card is not "not sold"');
});

test('a Line plays its completed row; complete since the song that completed it', () => {
  const queue = [5, 20, 6, 7, 21, 8, 1, 2];
  const r = check(1, queue, 6);
  assert.equal(r.outcome, 'complete');
  assert.equal(r.row, 1);
  assert.deepEqual(r.otherRows, []);
  assert.deepEqual(r.steps, [5, 6, 7, 8].map((songId) => ({ songId, landed: true })));
  assert.equal(r.completeSince, 5, 'song 8 landed at Queue index 5');
});

test('only the counted landings count: a song later in the Queue has not landed', () => {
  const queue = [5, 6, 7, 30, 8];
  const r = check(1, queue, 4);
  assert.equal(r.outcome, 'incomplete');
  assert.deepEqual(r.steps.map((s) => s.landed), [true, true, true, false]);
  assert.equal(r.completeSince, null);
});

test('two completed rows: the first to complete plays (top on a tie), the other is listed', () => {
  // Row 2 (9-12) completes at index 3, row 0 (1-4) at index 7.
  const r = check(1, [9, 10, 11, 12, 1, 2, 3, 4], 8);
  assert.equal(r.row, 2);
  assert.deepEqual(r.otherRows, [0]);
  assert.equal(r.completeSince, 3);
  // Card 2 has the same songs with its rows in another order: its row 0 is songs 9-12.
  assert.equal(check(2, [9, 10, 11, 12, 1, 2, 3, 4], 8).row, 0);
});

test('no completed row: the row with most landed songs plays, the top one on a tie', () => {
  assert.equal(check(1, [5, 6, 9, 10, 11], 5).row, 2);
  const tie = check(1, [1, 2, 5, 6], 4);
  assert.equal(tie.row, 0);
  assert.equal(tie.outcome, 'incomplete');
  assert.equal(check(1, [], 0).row, 0, 'nothing landed: the top row');
});

test('a Bingo plays all 12 songs row by row; complete since its last song', () => {
  const queue = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 40];
  const r = check(1, queue, 13, { kind: 'bingo' });
  assert.equal(r.outcome, 'complete');
  assert.equal(r.row, null);
  assert.deepEqual(r.otherRows, []);
  assert.deepEqual(r.steps.map((s) => s.songId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(r.completeSince, 11);
  const short = check(1, queue, 11, { kind: 'bingo' });
  assert.equal(short.outcome, 'incomplete');
  assert.deepEqual(short.steps.filter((s) => !s.landed).map((s) => s.songId), [1]);
});

test('the steps are timed in advance: a lead, ✓ steps, shorter ✗ steps, gaps, and the result after them', () => {
  const t = FLOW.check;
  const songs = [{ songId: 1, landed: true }, { songId: 2, landed: false }, { songId: 3, landed: true }];
  const timed = timeCheck(songs, 100, t);
  assert.equal(timed.startAt, 100);
  const expected = [100 + t.leadSec, 100 + t.leadSec + t.stepSec + t.gapSec, 100 + t.leadSec + t.stepSec + t.missSec + 2 * t.gapSec];
  timed.steps.forEach((s, i) => assert.ok(Math.abs(s.at - expected[i]) < 1e-9, `step ${i} at ${s.at}, not ${expected[i]}`));
  assert.deepEqual(timed.steps.map((s) => s.durationSec), [t.stepSec, t.missSec, t.stepSec]);
  const last = timed.steps[2];
  assert.equal(timed.endAt, last.at + last.durationSec + t.tailSec);
  assert.equal(t.stepSec, 2.5, 'the agreed default: 2.5 s per ✓ step');
  assert.deepEqual(timeCheck([], 100, t), { steps: [], startAt: 100, endAt: 100 }, 'no steps: the result at once');
});
