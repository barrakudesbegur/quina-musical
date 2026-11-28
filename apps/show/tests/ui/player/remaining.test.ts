// The header's count (#72), and the near-win cue's songs (28 Nov: the chime and the buzz only; the highlight is gone, §8 Y1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMarks, type PlayerCard } from '../../../../../packages/rules/marks.ts';
import { nearKeys, remainingSongs } from '../../../../player/logic/remaining.ts';

const card: PlayerCard = { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] };
const open = { lineConfirmed: false, ended: false };

test('the remaining-songs pill (#72) counts only where songs are counted', () => {
  const m = cardMarks(card, [2, 17, 41]);
  assert.equal(remainingSongs(card, m, open), 1);
  assert.equal(remainingSongs(card, m, { lineConfirmed: true, ended: false }), 9);
  assert.equal(remainingSongs(card, m, { ...open, ended: true }), null, 'not after the round');
  assert.equal(remainingSongs(card, m, { ...open, kind: 'desgraciat' }), null, 'the Desgraciat round shows DEMPEUS / ASSEGUT instead');
  assert.equal(remainingSongs(card, null, open), null, 'a card that does not play');
});

test('near-win: the song each card is missing for a Line, one key per song, in card order', () => {
  const other: PlayerCard = { id: 57, type: 'normal', lines: [[4, 9, 10, 12], [5, 6, 7, 8], [20, 21, 22, 23]] };
  const cards = [
    { cardId: 123, card, marks: cardMarks(card, [2, 17, 41, 11, 15, 31]) },
    { cardId: 57, card: other, marks: cardMarks(other, [4, 9, 10]) },
  ];
  assert.deepEqual(nearKeys(cards, open), ['123:69', '123:64', '57:12']);
  assert.deepEqual(nearKeys([{ cardId: 123, card, marks: cardMarks(card, [2, 17]) }], open), [], 'two songs away: nothing');
});

test('near-win: once a Line is confirmed only the last song for the Quina counts', () => {
  const all = card.lines.flat();
  assert.deepEqual(nearKeys([{ cardId: 123, card, marks: cardMarks(card, all.filter((id) => id !== 55)) }], { lineConfirmed: true, ended: false }), ['123:55']);
  assert.deepEqual(nearKeys([{ cardId: 123, card, marks: cardMarks(card, [2, 17, 41]) }], { lineConfirmed: true, ended: false }), []);
});

test('near-win: nothing after the round, in the Desgraciat round, without a round or for a card that does not play', () => {
  const near = [{ cardId: 123, card, marks: cardMarks(card, [2, 17, 41]) }];
  assert.deepEqual(nearKeys(near, { ...open, ended: true }), []);
  assert.deepEqual(nearKeys(near, { ...open, kind: 'desgraciat' }), []);
  assert.deepEqual(nearKeys(near, null), []);
  assert.deepEqual(nearKeys([{ cardId: 123, card, marks: null }], open), []);
  assert.deepEqual(nearKeys([{ cardId: 999, card: null, marks: null }], open), []);
});
