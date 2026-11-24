import test from 'node:test';
import assert from 'node:assert/strict';
import { spinWindow, slotSec, autoPressAt, driftNudge, scheduleEstimate, defaultPace, SPIN_LIMITS, PACE_PRESETS, roundLengthSec } from '../engine/src/plan/pace.ts';

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
