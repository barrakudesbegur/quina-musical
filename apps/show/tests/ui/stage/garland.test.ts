// The Heat garland: every light on, only colour/glow/twinkle follow the Heat; reduced motion steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeHeatSample, garlandLook, heatDisplay } from '../../../../stage/model/garland.ts';
import { STAGE } from '../../../../stage/config.ts';

test('cool, warm and hot looks', () => {
  assert.deepEqual(garlandLook(0), { warm: 0, hot: 0, glow: 0, twinkleMs: 3200, chase: 0 });
  const warm = garlandLook(0.5);
  assert.equal(warm.warm, 1);
  assert.equal(warm.hot, 0);
  const hot = garlandLook(1);
  assert.deepEqual([hot.warm, hot.hot, hot.glow, hot.twinkleMs, hot.chase], [1, 1, 1, 1000, 1]);
  assert.deepEqual(garlandLook(null), garlandLook(0));
  assert.deepEqual(garlandLook(7), garlandLook(1));
});

test('the twinkle speed is quantised, so small Heat changes never restart the animation', () => {
  assert.equal(garlandLook(0.51).twinkleMs, garlandLook(0.55).twinkleMs);
});

test('the displayed Heat eases, or steps under reduced motion', () => {
  const samples = [
    { value: 0.2, fromMs: 0, toMs: 20000 },
    { value: 0.8, fromMs: 30000, toMs: 50000 },
  ];
  const eased = heatDisplay(samples, 40000, false);
  assert.ok(eased > 0.2 && eased < 0.8);
  assert.equal(heatDisplay(samples, 40000, true), 0.8);
  assert.equal(heatDisplay(samples, 29999, true), 0.2);
  assert.equal(heatDisplay([], 0, false), STAGE.heatNeutral);
});

test('a page loaded mid-round shows a calm glow, never the target before its sample starts', () => {
  const future = [{ value: 0.9, fromMs: 10000, toMs: 30000 }];
  assert.equal(heatDisplay(future, 5000, false), STAGE.heatNeutral);
  assert.equal(heatDisplay(future, 5000, true), STAGE.heatNeutral);
});

test('the active sample is the latest that has started', () => {
  const samples = [
    { value: 0.2, fromMs: 0, toMs: 20000 },
    { value: 0.8, fromMs: 30000, toMs: 50000 },
  ];
  assert.equal(activeHeatSample(samples, -1), null);
  assert.equal(activeHeatSample(samples, 10)?.value, 0.2);
  assert.equal(activeHeatSample(samples, 30000)?.value, 0.8);
});
