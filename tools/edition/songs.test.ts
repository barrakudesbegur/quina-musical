// The edition's songs from a repertoire's songs.json (tools/edition/songs.ts), checked by the protocol's checkEdition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { songsOf } from './songs.ts';

test('songs.json → the edition songs: id, title, artist and pool, nothing else; no pool is pool 1', () => {
  const songs = songsOf([
    { id: 1, title: 'a la freSka', artist: 'Figa Flawas', cover: 'https://…', durationMs: 178231, spotifyId: 'x', pool: '1' },
    { id: 71, title: '6 DE FEBRERO', artist: 'Aitana', pool: '2' },
    { id: 3, title: 'Old', artist: 'A' },
  ]);
  assert.deepEqual(songs, [
    { id: 1, title: 'a la freSka', artist: 'Figa Flawas', pool: '1' },
    { id: 71, title: '6 DE FEBRERO', artist: 'Aitana', pool: '2' },
    { id: 3, title: 'Old', artist: 'A', pool: '1' },
  ]);
  assert.throws(() => songsOf({}), /a list of songs/);
});
