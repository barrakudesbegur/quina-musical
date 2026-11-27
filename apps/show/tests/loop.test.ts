// The phrase loop (plan/loop.ts): which phrase repeats, counted from the hook the song landed on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstRepeatAt, lastBarsLoop, lastPhraseLoop, loopSeconds, nextPhraseLoop } from '../engine/src/plan/loop.ts';
import type { Analysis } from '../engine/src/analysis.ts';

/** A steady song: a downbeat every 2 s for 60 bars (120 s). */
const analysis = { downbeats: Array.from({ length: 60 }, (_, k) => k * 2), source: { durationSec: 120 } } as unknown as Analysis;
/** It landed on its hook at bar 10, which sounded at context time 100. */
const song = { analysis, deck: { startCtx: 100, offset: 20 }, landedDownbeatIndex: 10 };

test('Suspense loops the 4-bar phrase that starts at the next boundary from the landed hook', () => {
  // At context 103 the song is at 23 s (bar 11.5): the next 4-bar boundary from bar 10 is bar 14.
  const loop = nextPhraseLoop(song, 103);
  assert.deepEqual(loop, { fromSec: 28, toSec: 36, fromIndex: 14, bars: 4 });
  assert.equal(firstRepeatAt(song.deck, loop), 116);
  assert.equal(loopSeconds(song.deck, loop), 8);
  assert.equal(nextPhraseLoop({ ...song, landedDownbeatIndex: null }, 103), null, 'no phrases without a landed hook');
  assert.equal(loopSeconds({ ...song.deck, rate: 1.04 }, loop), 8 / 1.04);
});

test('Aguanta loops the last full 8-bar phrase before the outro, else a 4-bar one', () => {
  // Phrases of 8 from bar 10: 2, 10, 18, 26, 34, 42, 50 (bars); the outro's last 8 s (from 112 s) stays out.
  assert.deepEqual(lastPhraseLoop(song, 100, 8), { fromSec: 84, toSec: 100, fromIndex: 42, bars: 8 });
  // Too close to the end for an 8-bar phrase that ends by 112 s: the last 4-bar one.
  assert.deepEqual(lastPhraseLoop(song, 175, 8), { fromSec: 100, toSec: 108, fromIndex: 50, bars: 4 });
  assert.equal(lastPhraseLoop(song, 190, 8), null, 'nothing left before the outro');
});

test("when no phrase fits, a song left playing loops its last 4 bars before the outro (D239)", () => {
  // No landed hook, so no phrases: the last 4 bars that end by 112 s are bars 52–56 (104–112 s).
  const noHook = { ...song, landedDownbeatIndex: null };
  assert.equal(lastPhraseLoop(noHook, 175, 8), null);
  assert.deepEqual(lastBarsLoop(noHook, 175, 8), { fromSec: 104, toSec: 112, fromIndex: 52, bars: 4 });
  // Already inside those 4 bars (at 109 s): they still end ahead, so the deck jumps back from 112 s.
  assert.deepEqual(lastBarsLoop(noHook, 189, 8), { fromSec: 104, toSec: 112, fromIndex: 52, bars: 4 });
  assert.equal(lastBarsLoop(noHook, 193, 8), null, 'past them: nothing ahead to loop');
});
