// The Heat garland: colour and glow follow the Heat, the lights play its level's pattern; reduced motion steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeHeatSample, garlandLook, heatDisplay } from '../../../../stage/model/garland.ts';
import { STAGE } from '../../../../stage/config.ts';

test('cool, warm and hot looks, each with its pattern', () => {
  const cool = garlandLook(0);
  assert.deepEqual([cool.warm, cool.hot, cool.glow, cool.lights.pattern, cool.lights.fire], [0, 0, 0, 'breathe', false]);
  const warm = garlandLook(0.5);
  assert.deepEqual([warm.warm, warm.hot, warm.lights.pattern], [1, 0, 'chase']);
  assert.equal(garlandLook(0.3).lights.pattern, 'wave');
  const hot = garlandLook(1);
  assert.deepEqual([hot.warm, hot.hot, hot.glow, hot.lights.pattern, hot.lights.fire], [1, 1, 1, 'fire', true]);
  assert.deepEqual(garlandLook(null), garlandLook(0));
  assert.deepEqual(garlandLook(7), garlandLook(1));
});

test('the pattern only changes when the Heat crosses a level, so the CSS animation is rarely restarted', () => {
  assert.deepEqual(garlandLook(0.51).lights, garlandLook(0.7).lights);
  assert.notDeepEqual(garlandLook(0.74).lights, garlandLook(0.76).lights);
});

test('a Celebration plays the win: the party colours, with flames when very hot', () => {
  const win = garlandLook(0.9, 'win');
  assert.deepEqual([win.lights.pattern, win.lights.palette, win.lights.fire], ['win', 'party', true]);
  assert.equal(win.glow, 0.9, 'the glow still says the Heat');
  assert.equal(garlandLook(0.2, 'win').lights.fire, false);
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
