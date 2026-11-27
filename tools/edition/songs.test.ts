// The edition's songs from a repertoire's songs.json (tools/edition/songs.ts), checked by the protocol's checkEdition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { songsOf } from './songs.ts';

test('songs.json → the edition songs: id, title, artist and pools, nothing else (D268); no pools is pool 1', () => {
  const songs = songsOf([
    { id: 1, title: 'a la freSka', artist: 'Figa Flawas', cover: 'https://…', durationMs: 178231, spotifyId: 'x', pool: '1', pools: ['1'] },
    { id: 6, title: 'Bailando por Ahi', artist: 'Juan Magan', pool: '1', pools: ['1', '2'] },
    { id: 71, title: '6 DE FEBRERO', artist: 'Aitana', pool: '2', pools: ['2'] },
    { id: 72, title: 'Old pool', artist: 'B', pool: '2' },
    { id: 3, title: 'Old', artist: 'A' },
  ]);
  assert.deepEqual(songs, [
    { id: 1, title: 'a la freSka', artist: 'Figa Flawas', pools: ['1'] },
    { id: 6, title: 'Bailando por Ahi', artist: 'Juan Magan', pools: ['1', '2'] },
    { id: 71, title: '6 DE FEBRERO', artist: 'Aitana', pools: ['2'] },
    { id: 72, title: 'Old pool', artist: 'B', pools: ['2'] },
    { id: 3, title: 'Old', artist: 'A', pools: ['1'] },
  ]);
  assert.deepEqual(songsOf([{ id: 9, title: 'X', artist: 'Y', pools: ['2', '1'] }]).map((s) => s.pools), [['1', '2']], 'sorted');
  assert.throws(() => songsOf({}), /a list of songs/);
});

test('songs.json → the edition songs: the print names, where songs.json has them, are the titles and artists', () => {
  const songs = songsOf([
    { id: 5, title: 'Aserejé', artist: 'Grupo Arenas', pools: ['1'] },
    { id: 128, title: 'The Ketchup Song (Aserejé) - Spanglish Version', artist: 'Las Ketchup', printTitle: 'Aserejé', pools: ['2'] },
    { id: 129, title: 'Timber', artist: 'Pitbull, Kesha, Other', printArtist: 'Pitbull, Kesha', pools: ['2'] },
  ]);
  assert.deepEqual(songs, [
    { id: 5, title: 'Aserejé', artist: 'Grupo Arenas', pools: ['1'] },
    { id: 128, title: 'Aserejé', artist: 'Las Ketchup', pools: ['2'] },
    { id: 129, title: 'Timber', artist: 'Pitbull, Kesha', pools: ['2'] },
  ]);
});
