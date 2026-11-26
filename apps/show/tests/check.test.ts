// The Check (game/check.ts): outcomes, the row a Line plays, where its reveals stop, the marked card, when the card
// completed, warnings, and what each reveal sounds like.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCheck, stepSound, type CheckInput } from '../engine/src/game/check.ts';
import { FLOW } from '../engine/src/config.ts';
import type { Card } from '../engine/src/game/cards.ts';

// Song ids are plain numbers here. Card 1: rows 1-4, 5-8, 9-12. Card 2: the same songs, rows in another order.
const normal: Card = { id: 1, type: 'normal', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] };
const other: Card = { id: 2, type: 'normal', lines: [[9, 10, 11, 12], [1, 2, 3, 4], [5, 6, 7, 8]] };
const special: Card = { id: 400, type: 'especial', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] };
const allCards = [normal, other, special];

/** A Check on `queue` after its first `landed` songs have landed. */
function check(cardId: number, queue: number[], landed: number, over: Partial<CheckInput> = {}) {
  return computeCheck({ allCards, cardId, kind: 'line', cardType: 'normal', cardsInPlay: new Set([1, 2, 400]), queue, position: landed - 1, ...over });
}

test('a number outside the generated cards, or of another type than the round\'s, has no steps', () => {
  assert.deepEqual(check(9999, [1, 2, 3, 4], 4), { outcome: 'unknownCard', row: null, otherRows: [], steps: [], revealUntil: null, markedCard: [], completeSince: null, warnings: [] });
  const wrong = check(400, [1, 2, 3, 4], 4);
  assert.equal(wrong.outcome, 'wrongType');
  assert.deepEqual(wrong.steps, []);
  assert.equal(wrong.revealUntil, null, 'nothing to reveal: the first press is the cue');
  assert.equal(check(1, [1, 2, 3, 4], 4, { cardType: 'especial' }).outcome, 'wrongType', 'a normal card in a round of especial cards');
  assert.equal(check(400, [1, 2, 3, 4], 4, { cardType: 'especial' }).outcome, 'complete');
  assert.equal(check(1, [1, 2, 3, 4], 4, { cardType: 'desgraciat' }).outcome, 'wrongType', 'any type the round does not play');
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
  assert.equal(r.revealUntil, 3, 'all four revealed');
  assert.equal(r.completeSince, 5, 'song 8 landed at Queue index 5');
  // The console's private view: the whole card in its grid order, marked (D108).
  assert.deepEqual(r.markedCard.map((s) => s.songId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(r.markedCard.filter((s) => s.landed).map((s) => s.songId), [1, 5, 6, 7, 8].filter((id) => queue.slice(0, 6).includes(id)));
});

test('only the counted landings count: a song later in the Queue has not landed', () => {
  const queue = [5, 6, 7, 30, 8];
  const r = check(1, queue, 4);
  assert.equal(r.outcome, 'incomplete');
  assert.deepEqual(r.steps.map((s) => s.landed), [true, true, true, false]);
  assert.equal(r.revealUntil, 3, 'the reveals stop at the first ✗ (D117)');
  assert.equal(check(1, [5, 30, 7], 3).revealUntil, 1, 'the second song never landed: two reveals, then the cue');
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

test('each revealed song sounds by itself: ✓ the snippet, ✗ the broken record, a standing ✓ the knock', () => {
  const t = FLOW.check;
  assert.deepEqual(stepSound({ songId: 1, landed: true }, 'line', t), { sound: 'snippet', durationSec: t.stepSec });
  assert.deepEqual(stepSound({ songId: 1, landed: false }, 'bingo', t), { sound: 'miss', durationSec: t.missSec });
  assert.deepEqual(stepSound({ songId: 1, landed: false }, 'standing', t), { sound: 'still', durationSec: t.stillSec });
  assert.deepEqual(stepSound({ songId: 1, landed: true }, 'standing', t), { sound: 'snippet', durationSec: t.stepSec }, 'the proof that sank it');
  assert.equal(t.stepSec, 2.5, 'the agreed default: 2.5 s per ✓');
});
