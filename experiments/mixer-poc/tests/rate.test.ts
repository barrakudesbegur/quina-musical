// P5, rate ramps (plan/rate.ts): the advance of an exponential or linear ramp and its inverse, and the power-up
// start offset, checked against a simulation of how AudioBufferSourceNode really plays a k-rate playbackRate:
// one rate per render quantum of 128 frames, read at the quantum's start. test.html checks the same through the
// real Web Audio graph (D14's landings: B's click at T within ±5 ms).
import test from 'node:test';
import assert from 'node:assert/strict';
import { expRampAdvance, expRampTimeAt, powerUpOffset, rampAdvanceUntil, rampTimeAt } from '../engine/src/plan/rate.ts';
import type { RateRamp } from '../engine/src/plan/rate.ts';

const SR = 48000;
const QUANTUM = 128;

/** Numerical integral of a ramp's rate from t0 to `t` (fine steps). */
function integrate(r: RateRamp, t: number): number {
  const steps = 200000;
  const dt = (t - r.t0) / steps;
  let sum = 0;
  for (let k = 0; k < steps; k++) {
    const u = Math.min(1, (r.t0 + (k + 0.5) * dt - r.t0) / (r.t1 - r.t0));
    const rate = r.curve === 'exp' ? r.from * (r.to / r.from) ** u : r.from + (r.to - r.from) * u;
    sum += rate * dt;
  }
  return sum;
}

test('rate ramps: the advance of an exponential and a linear ramp, and their inverses', () => {
  assert.ok(Math.abs(expRampAdvance(0.25, 1, 0.4) - (0.4 * 0.75) / Math.log(4)) < 1e-12);
  assert.equal(expRampAdvance(1, 1, 0.5), 0.5);
  for (const r of [
    { t0: 2, t1: 2.45, from: 0.25, to: 1, curve: 'exp' },
    { t0: 10, t1: 12, from: 1, to: 2 ** (5 / 12), curve: 'exp' },
    { t0: 0, t1: 0.8, from: 1, to: 0.02, curve: 'lin' },
  ] as const satisfies readonly RateRamp[]) {
    for (const f of [0.2, 0.5, 1, 1.3]) {
      const t = r.t0 + f * (r.t1 - r.t0);
      const x = rampAdvanceUntil(r, t);
      const truth = integrate(r, Math.min(t, r.t1)) + Math.max(0, t - r.t1) * r.to;
      assert.ok(Math.abs(x - truth) < 1e-6, `${r.curve} advance at ${f}: ${x} vs ${truth}`);
      assert.ok(Math.abs(rampTimeAt(r, x) - t) < 1e-9, `${r.curve} inverse at ${f}`);
    }
  }
  assert.ok(Math.abs(expRampTimeAt(0.25, 1, 0.4, expRampAdvance(0.25, 1, 0.4)) - 0.4) < 1e-12);
});

/**
 * Where a source started at `when` from `offset` is, in song seconds, at context time `at`, playing its rate
 * the way the browser does: the value of `rate(t)` at each render quantum's start, for the frames of that
 * quantum it plays.
 */
function kRatePosition(when: number, offset: number, rate: (t: number) => number, at: number): number {
  const startFrame = Math.round(when * SR);
  const endFrame = Math.round(at * SR);
  let pos = offset * SR;
  let frame = startFrame;
  while (frame < endFrame) {
    const quantumStart = Math.floor(frame / QUANTUM) * QUANTUM;
    const next = Math.min(quantumStart + QUANTUM, endFrame);
    pos += rate(quantumStart / SR) * (next - frame);
    frame = next;
  }
  return pos / SR;
}

test('P5 power-up: B ramping from a growl reaches its pickup on the plan\'s clock at P, within 0.3 ms of a k-rate source', () => {
  for (const [when, d, from] of [[12.3456, 0.35, 0.25], [7.0001, 0.45, 0.25], [100.2, 0.6, 0.25], [3.33, 0.6, 0.5]]) {
    const until = when + d;
    const pickupSec = 41.25;
    // The plan's clock: B would be at `pickupSec` at `until` had it run at rate 1 from `when`.
    const virtualOffset = pickupSec - d;
    const real = powerUpOffset({ virtualOffset, when, until, from, quantumSec: QUANTUM / SR });
    const rate = (t: number) => (t <= when ? from : t >= until ? 1 : from * (1 / from) ** ((t - when) / d));
    const reached = kRatePosition(when, real, rate, until);
    assert.ok(Math.abs(reached - pickupSec) < 0.0003, `${d} s from ${from}: ${((reached - pickupSec) * 1000).toFixed(3)} ms off`);
    // After the ramp B runs at rate 1, on the plan's clock.
    const later = kRatePosition(when, real, rate, until + 1.5);
    assert.ok(Math.abs(later - (pickupSec + 1.5)) < 0.0003);
    // Without the half-quantum correction it would lag by about a millisecond.
    const plain = kRatePosition(when, powerUpOffset({ virtualOffset, when, until, from }), rate, until);
    assert.ok(pickupSec - plain > 0.0005);
  }
});
