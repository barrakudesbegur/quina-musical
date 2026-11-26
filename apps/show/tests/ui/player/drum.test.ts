// The home screen's drum (board Mobil-B-J2): which covers its tiles show, how far it turns, and where a song row's
// card icons sit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRUM_TILES, drumSongs, drumTurn } from '../../../../player/logic/reel.ts';
import { markerLayout } from '../../../../player/logic/markers.ts';

const SONGS = Array.from({ length: 30 }, (_, i) => i + 1);

test('the drum shows only songs still to come, in an order that has nothing to do with the Queue', () => {
  const tiles = drumSongs(SONGS, new Set(), 3);
  assert.equal(tiles.length, DRUM_TILES);
  assert.equal(new Set(tiles).size, DRUM_TILES, 'ten different songs');
  assert.notDeepEqual(tiles, SONGS.slice(0, DRUM_TILES), 'shuffled, not in order');
  assert.deepEqual(drumSongs(SONGS, new Set(), 3), tiles, 'the same order for the same round');
  assert.notDeepEqual(drumSongs(SONGS, new Set(), 4), tiles, 'another round, another order');
  const landed = new Set([tiles[2] as number, tiles[7] as number]);
  const after = drumSongs(SONGS, landed, 3);
  assert.ok(after.every((id) => id !== null && !landed.has(id)), 'never a landed song');
  assert.deepEqual(
    after.filter((_, i) => i !== 2 && i !== 7),
    tiles.filter((_, i) => i !== 2 && i !== 7),
    'a landing changes only the tile that showed that song',
  );
});

test('the drum repeats songs when few are left, and shows card backs when none are', () => {
  const few = drumSongs([5, 6, 7], new Set([6]), 1);
  assert.equal(few.length, DRUM_TILES);
  assert.ok(few.every((id) => id === 5 || id === 7));
  assert.deepEqual(drumSongs([5], new Set([5]), 1), Array(DRUM_TILES).fill(null));
  assert.deepEqual(drumSongs([], new Set(), 1), Array(DRUM_TILES).fill(null), 'no catalog yet');
});

test('the drum stops on a whole tile', () => {
  assert.equal(drumTurn(37.4, 37.4), 37);
  assert.equal(drumTurn(0, 37.4), 0);
  assert.ok(Math.abs(drumTurn(18.7, 37.4) - 18.5) < 1e-9, 'scaled evenly along the way');
  assert.equal(drumTurn(12.3, null), 12.3, 'a Suspense coasts unscaled');
});

test("a song row's card icons pack zig-zag: one, a pair, a triangle, a rhombus", () => {
  assert.deepEqual(markerLayout(0), { width: 0, height: 50, spots: [] });
  assert.deepEqual(markerLayout(1), { width: 28, height: 50, spots: [{ left: 0, top: 11 }] });
  assert.deepEqual(markerLayout(2).spots, [{ left: 0, top: 11 }, { left: 25, top: 11 }]);
  const three = markerLayout(3);
  assert.equal(three.width, 53);
  assert.deepEqual(three.spots, [{ left: 0, top: 21 }, { left: 25, top: 21 }, { left: 12.5, top: 1 }]);
  const five = markerLayout(5);
  assert.equal(five.spots.filter((s) => s.top === 21).length, 3, 'three below');
  assert.equal(five.spots.filter((s) => s.top === 1).length, 2, 'two above');
});
