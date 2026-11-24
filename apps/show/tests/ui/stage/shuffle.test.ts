// The Shuffle on the projector: phases from the engine's window, a random visual order, a grid that flies
// into the drum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverFlights, gridShape, shuffleLayout, shufflePhaseAt, shuffleSequence, shuffleTimeline } from '../../../../stage/model/shuffle.ts';

const SPLIT = { appear: 1, jiggle: 2, fly: 5, settle: 1 };

/** A deterministic random source (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the sequence is a permutation drawn from the injected source', () => {
  const seq = shuffleSequence(77, seeded(1));
  assert.deepEqual([...seq].sort((a, b) => a - b), Array.from({ length: 77 }, (_, i) => i));
  assert.deepEqual(shuffleSequence(77, seeded(1)), seq, 'same source, same order');
  assert.notDeepEqual(shuffleSequence(77, seeded(2)), seq);
  assert.deepEqual(shuffleSequence(0, Math.random), []);
  assert.deepEqual(shuffleSequence(3, () => 0.9999999999), [0, 1, 2], 'a source near 1 swaps nothing');
});

test('a source that returns 1 never breaks the permutation', () => {
  const seq = shuffleSequence(10, () => 1);
  assert.deepEqual([...seq].sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i));
});

test('the visual order is unrelated to the grid order (it is not the identity, not sorted)', () => {
  const seq = shuffleSequence(77, seeded(7));
  const inPlace = seq.filter((tile, k) => tile === k).length;
  assert.ok(inPlace < 10, `${inPlace} tiles kept their place`);
});

test('the grid picks the biggest square tiles', () => {
  assert.deepEqual(gridShape(77, 1360, 1000), { cols: 10, rows: 8, tile: 125 });
  assert.deepEqual(gridShape(0, 100, 100), { cols: 0, rows: 0, tile: 0 });
  const one = gridShape(1, 300, 100);
  assert.equal(one.tile, 100);
});

test('every tile flies to the drum centre', () => {
  const tiles = shuffleLayout(12, { x: 0, y: 0, width: 400, height: 300 }, { x: 200, y: 100 });
  assert.equal(tiles.length, 12);
  for (const t of tiles) {
    assert.ok(Math.abs(t.x + t.size / 2 + t.dx - 200) < 1e-9);
    assert.ok(Math.abs(t.y + t.size / 2 + t.dy - 100) < 1e-9);
    assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.size <= 400 && t.y + t.size <= 300);
  }
});

test('the phases split the engine window', () => {
  const t = shuffleTimeline(1000, 10000, SPLIT);
  assert.deepEqual(t, { startAtMs: 1000, jiggleAtMs: 2000, flyAtMs: 4000, settleAtMs: 9000, endAtMs: 10000 });
  assert.equal(shufflePhaseAt(t, 999), 'before');
  assert.equal(shufflePhaseAt(t, 1000), 'appear');
  assert.equal(shufflePhaseAt(t, 2000), 'jiggle');
  assert.equal(shufflePhaseAt(t, 4000), 'fly');
  assert.equal(shufflePhaseAt(t, 9000), 'settle');
  assert.equal(shufflePhaseAt(t, 10000), 'done');
});

test('flights follow the sequence, staggered across the fly step', () => {
  const t = shuffleTimeline(1000, 10000, SPLIT);
  const seq = [2, 0, 3, 1];
  const flights = coverFlights(t, seq, 600);
  assert.equal(flights[2].startMs, 4000, 'the first in the sequence flies first');
  assert.equal(flights[1].startMs + flights[1].durationMs, 9000, 'the last arrives as the step ends');
  const starts = seq.map((tile) => flights[tile].startMs);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  const short = coverFlights(shuffleTimeline(0, 900, SPLIT), [0, 1], 600);
  assert.ok(short.every((f) => f.durationMs <= 500));
});
