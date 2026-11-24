// cards.json parsing: cards and the song index come from the printed cards; bad cards are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../../ui/data/catalog.ts';

test('cards and song titles come from cards.json', () => {
  const json = [
    { id: 1, type: 'normal', lines: [[{ id: 2, title: 'All Night', artist: 'Icona Pop' }, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13]] },
    { id: 2, type: 'especial', lines: [[1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]] },
    'junk',
  ];
  const { cards, songs, skipped } = parseCards(json);
  assert.equal(cards.size, 1);
  assert.equal(skipped, 2);
  assert.deepEqual(cards.get(1)?.lines[0], [2, 3, 4, 5]);
  assert.equal(songs.get(2)?.title, 'All Night');
});
