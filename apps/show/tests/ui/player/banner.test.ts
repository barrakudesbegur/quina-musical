// The "1 song away" banner across cards: card order and colours, Quina before Línia, latching (it never
// changes because the player's own card completed), the grace rule, Back, a confirmed Line, the round's end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bannerItems, type BannerCard } from '../../../../player/logic/banner.ts';

const A: BannerCard = { card: { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] }, color: 1, name: 'Àvia' };
const B: BannerCard = { card: { id: 57, type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]] }, color: 2, name: null };
const open = { lineConfirmed: false, ended: false };
const lineDone = { lineConfirmed: true, ended: false };
const cardA = A.card.lines.flat();

test('each card 1 song from a Line gets an item naming the card and the song, in card order', () => {
  const items = bannerItems([A, B], [2, 17, 41, 62, 16], open);
  assert.deepEqual(items, [
    { key: 'line:123:69', cardId: 123, color: 1, name: 'Àvia', kind: 'line', songIds: [69] },
    { key: 'line:57:20', cardId: 57, color: 2, name: null, kind: 'line', songIds: [20] },
  ]);
});

test('nothing for cards that are further away', () => {
  assert.deepEqual(bannerItems([A, B], [2, 17], open), []);
});

test('several Lines of one card missing different songs make one item, songs in card order', () => {
  const items = bannerItems([A], [11, 15, 31, 2, 17, 41], open);
  assert.deepEqual(items.map((i) => [i.kind, i.songIds]), [['line', [69, 64]]]);
});

test('a Line item stays up, unchanged, once that Line completes (until a Line is confirmed)', () => {
  const before = bannerItems([A], [2, 17, 41], open);
  const after = bannerItems([A], [2, 17, 41, 69], open);
  const later = bannerItems([A], [2, 17, 41, 69, 99, 98], open);
  assert.deepEqual(after, before);
  assert.deepEqual(later, before);
  assert.deepEqual(bannerItems([A], [2, 17, 41, 69], lineDone), []);
});

test('Back undoes a latch: a landing that is gone never counted', () => {
  assert.deepEqual(bannerItems([A], [2, 17, 99], open), []);
});

test('1 song from Quina: one Quina item, its song not repeated under the Line, Quina before Línia', () => {
  const landed = cardA.filter((id) => id !== 66);
  const items = bannerItems([B, A], [62, 16, ...landed], open);
  assert.deepEqual(
    items.map((i) => [i.kind, i.cardId, i.songIds]),
    [
      ['bingo', 123, [66]],
      ['line', 57, [20]],
      // No Line confirmed yet: card 123's earlier near-Lines stay latched; 66 shows only under Quina.
      ['line', 123, [69, 64]],
    ],
  );
  assert.deepEqual(
    bannerItems([B, A], [62, 16, ...landed], lineDone).map((i) => i.key),
    ['bingo:123:66'],
  );
});

test('the grace rule: when the last song lands the item does not change, nor after the next song', () => {
  const eleven = cardA.filter((id) => id !== 66);
  const before = bannerItems([A], eleven, lineDone);
  assert.deepEqual(before.map((i) => i.key), ['bingo:123:66']);
  assert.deepEqual(bannerItems([A], [...eleven, 66], lineDone), before, 'held back: same banner');
  assert.deepEqual(bannerItems([A], [...eleven, 66, 99], lineDone), before, 'latched until the round ends');
});

test('nothing once the round has ended', () => {
  assert.deepEqual(bannerItems([A, B], [2, 17, 41], { lineConfirmed: false, ended: true }), []);
});
