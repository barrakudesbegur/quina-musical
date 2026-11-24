// The last songs on the projector: revealed only by landings, shown from their landing time, never more than 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LandingInfo } from '@quina/protocol';
import { noteOf, pruneNotes, revealedSongs, songsKey, undoNotes, visibleSongs, type SongLookup } from '../../../../stage/model/songs.ts';

const landing = (songId: number, position: number, atMs: number, undone = false): LandingInfo => ({
  songId,
  title: `T${songId}`,
  artist: `A${songId}`,
  position,
  atMs,
  undone,
});
const lookup: SongLookup = (id) => (id === 74 ? { title: 'Waka Waka', artist: 'Shakira' } : null);
const snap = (landings: LandingInfo[], position: number) => ({ landings, current: null, queue: { position, length: 77 } });

test('revealed songs come from counted landings, newest first', () => {
  const songs = revealedSongs(snap([landing(5, 0, 100), landing(9, 1, 200, true), landing(7, 1, 300)], 1), [], lookup);
  assert.deepEqual(songs.map((s) => s.songId), [7, 5]);
  assert.equal(songs[0].title, 'T7');
});

test('a landed event shows before its snapshot, titled from the catalog', () => {
  const songs = revealedSongs(snap([landing(7, 0, 100)], 0), [noteOf({ songId: 74, position: 1, atMs: 500 })], lookup);
  assert.deepEqual(songs.map((s) => [s.songId, s.title]), [[74, 'Waka Waka'], [7, 'T7']]);
});

test('an unknown song has no title rather than a made-up one', () => {
  const songs = revealedSongs(snap([], 0), [{ songId: 3, position: 0, atMs: 1 }], lookup);
  assert.equal(songs[0].title, null);
});

test('the snapshot wins over a note for the same position', () => {
  const songs = revealedSongs(snap([landing(7, 0, 100)], 0), [{ songId: 74, position: 0, atMs: 100 }], lookup);
  assert.deepEqual(songs.map((s) => s.songId), [7]);
});

test('current counts when no landing names it', () => {
  const state = { landings: [], current: { songId: 7, title: 'Boig', artist: 'Sau', hookId: 'h', posSec: 1, endsAtMs: null }, queue: { position: 4, length: 77 } };
  const songs = revealedSongs(state, [], lookup);
  assert.deepEqual(songs.map((s) => [s.songId, s.title, s.atMs]), [[7, 'Boig', 0]]);
});

test('notes are dropped once a later snapshot covers them, kept when newer', () => {
  const notes = [
    { songId: 1, position: 3, atMs: 1000 },
    { songId: 2, position: 4, atMs: 3000 },
  ];
  assert.deepEqual(pruneNotes(notes, { atMs: 2000, queue: { position: 3, length: 77 } }).map((n) => n.songId), [2]);
  // A snapshot that says position 4 does not count (undone) and is newer than the note: the note goes.
  assert.deepEqual(pruneNotes(notes, { atMs: 4000, queue: { position: 3, length: 77 } }), []);
});

test('Back drops the undone landing', () => {
  const notes = [
    { songId: 1, position: 3, atMs: 1000 },
    { songId: 2, position: 4, atMs: 3000 },
  ];
  assert.deepEqual(undoNotes(notes, { position: 4 }).map((n) => n.songId), [1]);
});

test('a song shows from its landing time, and only the last 3', () => {
  const songs = revealedSongs(snap([landing(1, 0, 100), landing(2, 1, 200), landing(3, 2, 300), landing(4, 3, 400), landing(5, 4, 1000)], 4), [], lookup);
  assert.deepEqual(visibleSongs(songs, 999, 3).map((s) => s.songId), [4, 3, 2], 'the next landing is not shown early');
  assert.deepEqual(visibleSongs(songs, 1000, 3).map((s) => s.songId), [5, 4, 3]);
  assert.equal(songsKey(visibleSongs(songs, 1000, 1)), '5@1000');
});
