// cards.json parsing: cards (with their sides) and the song index come from the printed cards; bad cards are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFace, catalogFace, parseCards } from '../../../../packages/ui/data/catalog.ts';

test('cards and song titles come from cards.json; a card from before sides is its side 1', () => {
  const json = [
    { id: 1, type: 'normal', lines: [[{ id: 2, title: 'All Night', artist: 'Icona Pop' }, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13]] },
    { id: 2, type: 'especial', lines: [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]] },
    'junk',
  ];
  const { cards, songs, skipped } = parseCards(json);
  assert.equal(cards.size, 1);
  assert.equal(skipped, 2);
  assert.deepEqual(cards.get(1)?.sides, [{ side: 1, lines: [[2, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13]] }]);
  assert.equal(songs.get(2)?.title, 'All Night');
});

test('a card printed on two sides (D102): each side read, and a round reads one through cardFace', () => {
  const side = (from: number) => [0, 1, 2].map((l) => [0, 1, 2, 3].map((c) => ({ id: from + l * 4 + c, title: `Song ${from + l * 4 + c}`, artist: 'A' })));
  const json = [
    { id: 7, type: 'normal', sides: [{ side: 1, lines: side(1) }, { side: 2, lines: side(71) }] },
    { id: 400, type: 'especial', sides: [{ side: 1, lines: side(13) }] },
  ];
  const catalog = parseCards(json);
  assert.equal(catalog.skipped, 0);
  const card = catalog.cards.get(7);
  assert.ok(card);
  assert.deepEqual(cardFace(card, 1), { id: 7, type: 'normal', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] });
  assert.deepEqual(cardFace(card, 2)?.lines[0], [71, 72, 73, 74]);
  assert.deepEqual(cardFace(card)?.lines[0], [1, 2, 3, 4], 'side 1 by default');
  assert.equal(catalogFace(catalog, 400, 2), null, 'the especial card has no side 2');
  assert.equal(catalogFace(catalog, 999, 1), null, 'not a printed card');
  assert.equal(catalogFace(null, 7, 1), null, 'no catalogue yet');
  assert.equal(catalog.songs.get(82)?.title, 'Song 82', "side 2's songs are in the index too");
});

test('a card with a bad side is skipped whole, never half read', () => {
  const lines = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
  const bad = [
    { id: 1, type: 'normal', sides: [] },
    { id: 2, type: 'normal', sides: [{ side: 1, lines }, { side: 1, lines }] },
    { id: 3, type: 'normal', sides: [{ side: 0, lines }] },
    { id: 4, type: 'normal', sides: [{ side: 1, lines }, { side: 2, lines: [[1, 2, 3, 4]] }] },
    { id: 5, type: 'normal', sides: [{ side: 1 }] },
    { id: 6, type: 'normal', sides: 'both', lines },
  ];
  const { cards, skipped } = parseCards(bad);
  assert.equal(cards.size, 0);
  assert.equal(skipped, bad.length);
});
