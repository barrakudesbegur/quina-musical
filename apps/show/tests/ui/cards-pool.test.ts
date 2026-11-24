// The printed cards come from a song pool (apps/cards/src/pool.ts): the command line names it, its paths resolve
// against the repo, and its songs are checked before a card is drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_POOL, parsePool, poolNameFrom, songProblems } from '../../../cards/src/pool.ts';

test('the pool comes from --pool, else the default one', () => {
  assert.equal(poolNameFrom([]), DEFAULT_POOL);
  assert.equal(poolNameFrom(['--pool', 'nadal26']), 'nadal26');
  assert.equal(poolNameFrom(['--check', '--pool=nadal26']), 'nadal26');
  assert.throws(() => poolNameFrom(['--pool']), /needs a pool name/);
  assert.throws(() => poolNameFrom(['--pool', '../etc']), /needs a pool name/);
});

test("a pool's paths are made absolute against the repo; a file that isn't a pool is refused", () => {
  const pool = parsePool('x', { songsJson: 'data/pools/x/songs.json', cardsJson: 'apps/cards/dist/cards.json' }, '/repo');
  assert.deepEqual(pool, { name: 'x', songsJson: '/repo/data/pools/x/songs.json', cardsJson: '/repo/apps/cards/dist/cards.json' });
  assert.throws(() => parsePool('x', { songsJson: 'a.json' }, '/repo'), /needs "songsJson" and "cardsJson"/);
});

test("a pool's songs are checked before any card is drawn", () => {
  const song = (id: number) => ({ id, title: `Song ${id}`, artist: 'A', cover: '', spotifyId: '' });
  assert.deepEqual(songProblems(Array.from({ length: 12 }, (_, i) => song(i + 1)), 12), []);
  assert.deepEqual(songProblems([song(1)], 12), ['a card needs 12 songs; the pool has 1']);
  const bad = songProblems([song(1), song(1), { id: 2, title: ' ', artist: 'A' }, 'x'], 2);
  assert.deepEqual(bad, ['song 2: id 1 is used twice', 'song 3: no title', 'song 4: not an object']);
  assert.deepEqual(songProblems({}, 12), ['the songs file must be a list of songs']);
});

test("the default pool (last year's songs) is fit for cards", () => {
  const pool = JSON.parse(readFileSync(new URL('../../../../data/pools/default.json', import.meta.url), 'utf8'));
  const songs = JSON.parse(readFileSync(new URL(`../../../../${pool.songsJson}`, import.meta.url), 'utf8'));
  assert.deepEqual(songProblems(songs, 12), []);
});
