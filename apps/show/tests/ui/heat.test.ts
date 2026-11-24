// Heat display: never moves at a landing, eases to new targets, both screens agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAT, HeatSmoother, heatAt } from '../../ui/rules/heat.ts';

test('heatAt holds the previous value until a sample starts, then eases to it', () => {
  const samples = [{ value: 0.8, fromMs: 10_000, toMs: 30_000 }];
  assert.equal(heatAt(samples, 5_000, 0.2), 0.2);
  const mid = heatAt(samples, 20_000, 0.2);
  assert.ok(mid > 0.2 && mid < 0.8, `mid ${mid}`);
  assert.equal(heatAt(samples, 31_000, 0.2), 0.8);
});

test('a new target never shows at the moment it arrives (the landing)', () => {
  const smoother = new HeatSmoother(() => 0);
  smoother.push(0.3, 0);
  const before = smoother.at(HEAT.delayMinMs + HEAT.easeMs + 1);
  smoother.push(0.9, 100_000);
  assert.equal(smoother.at(100_000), before);
  assert.equal(smoother.at(100_000 + HEAT.delayMinMs - 1), before);
  assert.ok(smoother.at(100_000 + HEAT.delayMinMs + HEAT.easeMs / 2) > before);
});

test('tiny changes are ignored', () => {
  const smoother = new HeatSmoother(() => 0.5);
  assert.equal(smoother.push(0.5, 0), true);
  assert.equal(smoother.push(0.51, 1000), false);
  assert.equal(smoother.push(null, 2000), false);
});

test('the start delay is random within its bounds', () => {
  const lo = new HeatSmoother(() => 0);
  const hi = new HeatSmoother(() => 0.999);
  lo.push(0.5, 0);
  hi.push(0.5, 0);
  assert.equal(lo.samples[0].fromMs, HEAT.delayMinMs);
  assert.ok(hi.samples[0].fromMs <= HEAT.delayMaxMs && hi.samples[0].fromMs > HEAT.delayMaxMs - 100);
});
