// Fitting the 1440×1080 box to 4:3, 16:10 and 16:9 screens (D276), the drum band, the credits roll.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOnScreen, boxBleed, creditsRollMs, fitBox, paperCount } from '../../../../stage/model/layout.ts';

test('a 4:3 projector fills the screen', () => {
  assert.deepEqual(fitBox(1024, 768, 1440, 1080), { scale: 1024 / 1440, x: 0, y: 0 });
});

test('16:9 is pillarboxed, centred', () => {
  const fit = fitBox(1920, 1080, 1440, 1080);
  assert.equal(fit.scale, 1);
  assert.equal(fit.x, 240);
  assert.equal(fit.y, 0);
});

test('16:10 is pillarboxed less, centred', () => {
  const fit = fitBox(1440, 900, 1440, 1080);
  assert.equal(fit.scale, 900 / 1080);
  assert.equal(fit.x, 120);
  assert.equal(fit.y, 0);
  assert.deepEqual(fitBox(1920, 1200, 1440, 1080), { scale: 1200 / 1080, x: 160, y: 0 });
});

test('the bleed is the pillar or letterbox in box px: none at 4:3, 144 at 16:10, 240 at 16:9', () => {
  assert.deepEqual(boxBleed(fitBox(1024, 768, 1440, 1080)), { x: 0, y: 0 });
  assert.deepEqual(boxBleed(fitBox(1280, 800, 1440, 1080)), { x: 144, y: 0 });
  assert.deepEqual(boxBleed(fitBox(1920, 1200, 1440, 1080)), { x: 144, y: 0 });
  assert.deepEqual(boxBleed(fitBox(1280, 720, 1440, 1080)), { x: 240, y: 0 });
  assert.deepEqual(boxBleed(fitBox(1440, 2000, 1440, 1080)), { x: 0, y: 460 });
  assert.deepEqual(boxBleed(fitBox(0, 0, 1440, 1080)), { x: 0, y: 0 });
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

test('a paper rain keeps its density on a wider canvas, never thinner', () => {
  assert.equal(paperCount(120, 1440, 1440), 120);
  assert.equal(paperCount(120, 1920, 1440), 160);
  assert.equal(paperCount(200, 1728, 1440), 240);
  assert.equal(paperCount(120, 1000, 1440), 120, 'a narrower canvas keeps the count');
  assert.equal(paperCount(120, 0, 1440), 120);
});
