// The your-song look (ANIMATIONS.md `your-song`, D74): when the landed song is on one of the phone's playing cards,
// gold until the next Spin starts; never in the Desgraciat round; a flash only for a landing seen live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YOUR_SONG_LIVE_MS, songsOnCards, yourSongEntry, yourSongOf, type YourSongInput } from '../../../../player/logic/your-song.ts';
import { PLAYER_DEMOS } from '../../../../player/feed/demo-feed.ts';

const T = 1_000_000;
const base: YourSongInput = {
  scene: 'play',
  paused: false,
  offline: false,
  round: { number: 3, kind: 'normal' },
  latest: { position: 7, songId: 69, atMs: T },
  spin: { startAtMs: T - 6000, landAtMs: T },
  songs: new Set([2, 17, 41, 69]),
  nowMs: T + 500,
};

test('the landed song on a playing card turns the screen gold, one key per landing', () => {
  assert.deepEqual(yourSongOf(base), { key: '3:7', songId: 69, atMs: T });
  assert.equal(yourSongOf({ ...base, latest: { position: 8, songId: 74, atMs: T } }), null, 'not on a playing card');
  assert.equal(yourSongOf({ ...base, latest: null }), null);
  assert.equal(yourSongOf({ ...base, round: { number: 7, kind: 'special' } })?.key, '7:7', 'the Quina Especial too');
});

test('never in the Desgraciat round (the card sits down instead), nor outside play, in a pause or offline', () => {
  assert.equal(yourSongOf({ ...base, round: { number: 5, kind: 'desgraciat' } }), null);
  for (const scene of ['check', 'celebration', 'interval', 'roundStart'] as const) assert.equal(yourSongOf({ ...base, scene }), null, scene);
  assert.equal(yourSongOf({ ...base, paused: true }), null);
  assert.equal(yourSongOf({ ...base, offline: true }), null);
});

test('it lasts until the next Spin starts (a Suspense too), not until one is announced', () => {
  const next = { startAtMs: T + 40_000, landAtMs: T + 52_000 };
  assert.ok(yourSongOf({ ...base, spin: next, nowMs: T + 39_999 }), 'announced, not started');
  assert.equal(yourSongOf({ ...base, spin: next, nowMs: T + 40_000 }), null, 'started');
  assert.equal(yourSongOf({ ...base, spin: { startAtMs: T + 40_000, landAtMs: null }, nowMs: T + 41_000 }), null, 'a Suspense');
  // Two in a row: the next landing is a new key, so the look plays again from the start.
  const second = yourSongOf({ ...base, latest: { position: 8, songId: 17, atMs: T + 52_000 }, spin: next, nowMs: T + 52_100 });
  assert.equal(second?.key, '3:8');
});

test('a landing seen live flashes; one found later fades in quietly; reduced motion is still', () => {
  assert.equal(yourSongEntry({ atMs: T }, T + 300, false), 'flash');
  assert.equal(yourSongEntry({ atMs: T }, T + YOUR_SONG_LIVE_MS, false), 'quiet', 'opening the app mid-song');
  assert.equal(yourSongEntry({ atMs: T }, T + 300, true), 'still');
});

test('the songs on the playing cards; a card still loading has none', () => {
  const cards = [{ card: { lines: [[1, 2], [3, 4]] } }, { card: null }, { card: { lines: [[4, 5]] } }];
  assert.deepEqual([...songsOnCards(cards)].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("the yourSong demo lands the phone's songs, two in a row, then one that isn't", () => {
  assert.deepEqual(PLAYER_DEMOS.yourSong.liveFirst, [69, 64, 74, 20]);
  assert.equal(PLAYER_DEMOS.yourSong.live, true);
});
