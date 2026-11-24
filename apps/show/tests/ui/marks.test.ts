// Player card marks: every landed song marked (no grace rule), Lines shown as plain marks, the "1 song away" list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMarks, cardsForRound, nearWins, type PlayerCard } from '../../../../packages/rules/marks.ts';

const card: PlayerCard = {
  id: 123,
  type: 'normal',
  lines: [
    [2, 17, 41, 69],
    [11, 15, 31, 64],
    [3, 55, 66, 68],
  ],
};
const all = card.lines.flat();

test('every landed song on the card is marked, the latest one included', () => {
  const m = cardMarks(card, [2, 99, 17, 41]);
  assert.deepEqual(m.marked[0], [true, true, true, false]);
  assert.equal(m.count, 3);
});

test('a Line completed by the latest song shows as plain marks', () => {
  const m = cardMarks(card, [2, 17, 41, 69]);
  assert.deepEqual(m.marked[0], [true, true, true, true]);
});

test('no grace rule: the song that completes the whole card is marked at once', () => {
  const landed = [...all.filter((id) => id !== 55), 55];
  const m = cardMarks(card, landed);
  assert.equal(m.marked[2][1], true);
  assert.equal(m.count, 12);
});

test('an undone landing is not passed in, so its song is not marked', () => {
  const m = cardMarks(card, [2, 17]);
  assert.deepEqual(m.marked[0], [true, true, false, false]);
});

test('1 song from a Line names the missing song; Lines stop counting once one is confirmed', () => {
  const m = cardMarks(card, [2, 17, 41]);
  assert.deepEqual(nearWins(card, m, { lineConfirmed: false, roundEnded: false }), [{ cardId: 123, kind: 'line', line: 0, missingSongId: 69 }]);
  assert.deepEqual(nearWins(card, m, { lineConfirmed: true, roundEnded: false }), []);
});

test('1 song from a Bingo names the one song still missing', () => {
  const m = cardMarks(card, all.filter((id) => id !== 55));
  const wins = nearWins(card, m, { lineConfirmed: true, roundEnded: false });
  assert.deepEqual(wins, [{ cardId: 123, kind: 'bingo', line: null, missingSongId: 55 }]);
});

test('no near wins once the round has ended', () => {
  const m = cardMarks(card, [2, 17, 41]);
  assert.deepEqual(nearWins(card, m, { lineConfirmed: false, roundEnded: true }), []);
});

test('two lines missing the same song are listed once', () => {
  const cross: PlayerCard = { id: 9, type: 'normal', lines: [[1, 2, 3, 50], [4, 5, 6, 50], [7, 8, 9, 10]] };
  const m = cardMarks(cross, [1, 2, 3, 4, 5, 6]);
  assert.equal(nearWins(cross, m, { lineConfirmed: false, roundEnded: false }).length, 1);
});

test('special cards count only in the special round', () => {
  const cards: PlayerCard[] = [card, { id: 412, type: 'especial', lines: card.lines }];
  assert.deepEqual(cardsForRound(cards, 'normal').map((c) => c.id), [123]);
  assert.deepEqual(cardsForRound(cards, 'special').map((c) => c.id), [412]);
});
