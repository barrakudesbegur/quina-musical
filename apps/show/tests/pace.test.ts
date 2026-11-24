import test from 'node:test';
import assert from 'node:assert/strict';
import { spinWindow, slotSec, autoPressAt, alignedPress, driftNudge, scheduleEstimate, defaultPace, SPIN_LIMITS, PACE_PRESETS, roundLengthSec } from '../engine/src/plan/pace.ts';
import type { PhraseGrid } from '../engine/src/plan/pace.ts';

/** A steady song that landed on its hook at 0: a downbeat every `bar` seconds, phrases counted from it. */
function steadyGrid(bar: number, { phrases = true } = {}): PhraseGrid {
  const downbeats = Array.from({ length: 100 }, (_, index) => ({ index, pos: index * bar, ctxTime: index * bar }));
  return {
    downbeatsBetween: (t0, t1) => downbeats.filter((d) => d.ctxTime >= t0 && d.ctxTime <= t1),
    phraseClass: (index) => (!phrases ? 'bar' : index % 8 === 0 ? 'phrase8' : index % 4 === 0 ? 'phrase4' : 'bar'),
  };
}

test('the Spin is about half the Pace, inside 3–11 s', () => {
  assert.equal(spinWindow({ pace: 14, phase: 'early' }).dTarget, 7);
  assert.equal(spinWindow({ pace: 22, phase: 'mid' }).dTarget, 11);
  assert.equal(spinWindow({ pace: 11, phase: 'early' }).dTarget, 5.5);
  assert.equal(spinWindow({ pace: 4, phase: 'early' }).dTarget, 3);
  for (const pace of [...PACE_PRESETS, 8, 60]) {
    for (const phase of ['early', 'mid', 'late', 'final']) {
      const w = spinWindow({ pace, phase });
      assert.ok(w.dMin >= SPIN_LIMITS[0] && w.dMax <= SPIN_LIMITS[1] && w.dMin <= w.dTarget && w.dTarget <= w.dMax, JSON.stringify(w));
    }
  }
});

test('late phases stretch the slot, a landing that completes a card by 50%, early and mid do not', () => {
  assert.equal(slotSec({ pace: 14, phase: 'early' }), 14);
  assert.ok(slotSec({ pace: 14, phase: 'late' }) > 14);
  assert.ok(slotSec({ pace: 14, phase: 'final' }) > 14);
  assert.equal(slotSec({ pace: 14, phase: 'final', minStretch: 1.5 }), 21);
  assert.equal(slotSec({ pace: 14, phase: 'early', minStretch: 1.5 }), 21);
  // The Spin itself keeps its normal length: the stretch is extra time on the landed song.
  const plain = autoPressAt({ landedAt: 0, pace: 14, phase: 'final' });
  const stretched = autoPressAt({ landedAt: 0, pace: 14, phase: 'final', minStretch: 1.5 });
  assert.ok(Math.abs(stretched - plain - (21 - slotSec({ pace: 14, phase: 'final' }))) < 1e-9);
});

test('auto-advance presses so landing to landing is one slot', () => {
  const at = autoPressAt({ landedAt: 100, pace: 14, phase: 'early' });
  assert.equal(at + spinWindow({ pace: 14, phase: 'early' }).dTarget, 114);
  // The landed song always plays alone for a moment, even at very short paces.
  assert.ok(autoPressAt({ landedAt: 100, pace: 6, phase: 'early' }) >= 102);
});

test('Drift nudges stay within ±20%, only early/mid, never when locked', () => {
  assert.equal(driftNudge({ driftSec: 600, position: 10, pace: 14, phase: 'early' }), 0.8);
  assert.equal(driftNudge({ driftSec: -600, position: 10, pace: 14, phase: 'mid' }), 1.2);
  assert.equal(driftNudge({ driftSec: 600, position: 10, pace: 14, phase: 'late' }), 1);
  assert.equal(driftNudge({ driftSec: 600, position: 10, pace: 14, phase: 'early', locked: true }), 1);
  const small = driftNudge({ driftSec: 30, position: 10, pace: 14, phase: 'early' });
  assert.ok(small < 1 && small > 0.9);
});

test('schedule: a round started on its target has no Drift, and later rounds add up', () => {
  const nowMs = 1_000_000;
  const pace = defaultPace(1);
  const round = { number: 1, targetEndMs: nowMs + 1000 * roundLengthSec({ pace }) };
  const est = scheduleEstimate({ nowMs, round, game: { roundsTotal: 3 }, position: -1, pace, phase: 'early', lineConfirmed: false });
  assert.ok(Math.abs(est.roundDriftSec) < 0.05 * roundLengthSec({ pace }), `drift ${est.roundDriftSec}`);
  assert.ok(est.gameEndMs > est.roundEndMs + 2 * 1000 * roundLengthSec({ pace: 14 }));
  assert.equal(est.gameDriftSec, null);
});

test('auto-advance lands on the phrase boundary nearest the slot: 8 bars first, else 4, timed back by the Spin', () => {
  const base = { idealLandAt: 14, slot: 14, dTarget: 7, earliestPress: 2, latestLand: 200, lookaheadSec: 0.08 };
  // 120 bpm, Pace 14: the 8-bar boundary at 16 s (×0.75–1.4 is 10.5–19.6 s); the press comes a Spin before it.
  const at16 = alignedPress({ grid: steadyGrid(2), ...base });
  assert.deepEqual(at16 && { landAt: at16.landAt, index: at16.index }, { landAt: 16, index: 8 });
  assert.ok(at16 && Math.abs(at16.pressAt - (16 - 7 - 0.08)) < 1e-9);
  // Pace 22: no 8-bar boundary in 16.5–30.8 s, so the 4-bar one at 24 s.
  assert.equal(alignedPress({ grid: steadyGrid(2), ...base, idealLandAt: 22, slot: 22, dTarget: 11 })?.landAt, 24);
  // An 8-bar boundary far from the slot loses to a much nearer 4-bar one: 30.4 s against 22.8 s for a 22 s slot.
  assert.ok(Math.abs((alignedPress({ grid: steadyGrid(1.9), ...base, idealLandAt: 22, slot: 22, dTarget: 11 })?.landAt ?? 0) - 22.8) < 1e-9);
  // A slow song whose phrases straddle the range (9.6 s and 19.2 s around 9.75–18.2 s): the nearest just outside it.
  assert.ok(Math.abs((alignedPress({ grid: steadyGrid(2.4), ...base, idealLandAt: 13, slot: 13 })?.landAt ?? 0) - 9.6) < 1e-9);
  // A slot stretched for a Claim is a minimum: 21 s lands on 24 s, never on 16 s.
  assert.equal(alignedPress({ grid: steadyGrid(2), ...base, idealLandAt: 21, slot: 21, minShare: 1 })?.landAt, 24);
  // Nothing fits: the song ends first, or there are no phrases to count (no landed hook).
  assert.equal(alignedPress({ grid: steadyGrid(2), ...base, latestLand: 6 }), null);
  assert.equal(alignedPress({ grid: steadyGrid(2, { phrases: false }), ...base }), null);
});
