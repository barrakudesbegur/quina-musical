// Fitting the 1440×1080 box to 4:3 and 16:9 screens, the drum band, the credits roll.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOnScreen, creditsRollMs, fitBox } from '../../../stage/model/layout.ts';

test('a 4:3 projector fills the screen', () => {
  assert.deepEqual(fitBox(1024, 768, 1440, 1080), { scale: 1024 / 1440, x: 0, y: 0 });
});

test('16:9 is pillarboxed, centred', () => {
  const fit = fitBox(1920, 1080, 1440, 1080);
  assert.equal(fit.scale, 1);
  assert.equal(fit.x, 240);
  assert.equal(fit.y, 0);
});

test('a tall window is letterboxed', () => {
  const fit = fitBox(1440, 2000, 1440, 1080);
  assert.equal(fit.scale, 1);
  assert.equal(fit.y, 460);
});

test('nothing to fit: scale 0, never NaN', () => {
  assert.deepEqual(fitBox(0, 0, 1440, 1080), { scale: 0, x: 0, y: 0 });
});

test('the drum band is scaled and placed with the box', () => {
  assert.deepEqual(bandOnScreen({ scale: 0.5, x: 10, y: 20 }, { top: 0, height: 640 }), { top: 20, height: 320 });
});

test('credits roll only when they overflow', () => {
  assert.equal(creditsRollMs(500, 800, 40), 0);
  assert.equal(creditsRollMs(1600, 800, 40), 60_000);
});
