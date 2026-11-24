// The logo clean-up's pixel pipeline on synthetic images: background detection, removal with a soft edge,
// keeping enclosed whites, trimming and fitting the size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanLogo,
  colorDistance,
  contentBounds,
  crop,
  detectBackground,
  fitInside,
  keepFactor,
  makePixels,
  removeBackground,
  toHex,
  type Pixels,
  type Rgb,
} from '../../../../admin/logic/logo-pixels.ts';

type Rgba = [number, number, number, number];
const WHITE: Rgba = [255, 255, 255, 255];
const RED: Rgba = [220, 30, 40, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

function image(width: number, height: number, fill: Rgba): Pixels {
  const p = makePixels(width, height);
  for (let k = 0; k < width * height; k++) p.data.set(fill, k * 4);
  return p;
}
function rect(p: Pixels, x0: number, y0: number, w: number, h: number, color: Rgba): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) p.data.set(color, (y * p.width + x) * 4);
}
const px = (p: Pixels, x: number, y: number) => Array.from(p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));
const alpha = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];

/** A logo: a red ring (with a white hole) on white, from (10,5) to (29,14), in a 40×20 image. */
function logo(): Pixels {
  const p = image(40, 20, WHITE);
  rect(p, 10, 5, 20, 10, RED);
  rect(p, 15, 8, 10, 4, WHITE);
  return p;
}

test('colorDistance and toHex', () => {
  assert.ok(Math.abs(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 255) < 1e-9);
  assert.equal(colorDistance({ r: 9, g: 9, b: 9 }, { r: 9, g: 9, b: 9 }), 0);
  assert.equal(toHex({ r: 255, g: 130, b: 0 }), '#ff8200');
});

test('the background is the colour the corners share', () => {
  assert.deepEqual(detectBackground(logo()), { kind: 'color', color: { r: 255, g: 255, b: 255 }, corners: 4 });
});

test('a logo touching one corner still finds the background from the other three', () => {
  const p = logo();
  rect(p, 0, 0, 6, 6, RED);
  const bg = detectBackground(p);
  assert.equal(bg.kind, 'color');
  if (bg.kind === 'color') assert.equal(bg.corners, 3);
});

test('transparent corners mean an already clean PNG; four different corners are unclear', () => {
  const png = image(10, 10, CLEAR);
  rect(png, 3, 3, 4, 4, RED);
  assert.deepEqual(detectBackground(png), { kind: 'transparent', corners: 4 });
  const odd = image(10, 10, WHITE);
  // Each corner patch (4×4) a different colour.
  rect(odd, 0, 0, 4, 4, RED);
  rect(odd, 6, 0, 4, 4, [0, 200, 0, 255]);
  rect(odd, 0, 6, 4, 4, [0, 0, 200, 255]);
  rect(odd, 6, 6, 4, 4, [20, 20, 20, 255]);
  assert.deepEqual(detectBackground(odd), { kind: 'unclear' });
  assert.deepEqual(detectBackground(makePixels(0, 0)), { kind: 'unclear' });
});

test('keepFactor: gone within the tolerance, a ramp over the soft edge, kept beyond', () => {
  assert.equal(keepFactor(10, 20, 10), 0);
  assert.equal(keepFactor(25, 20, 10), 0.5);
  assert.equal(keepFactor(30, 20, 10), 1);
  assert.equal(keepFactor(21, 20, 0), 1);
});

test("'edges' clears only the outer background and keeps the white inside the logo", () => {
  const out = removeBackground(logo(), { r: 255, g: 255, b: 255 }, { tolerance: 20, softness: 10, mode: 'edges' });
  assert.equal(alpha(out, 0, 0), 0);
  assert.equal(alpha(out, 39, 19), 0);
  assert.equal(alpha(out, 12, 6), 255, 'the logo stays');
  assert.equal(alpha(out, 20, 10), 255, 'the enclosed white stays');
});

test("'all' clears the background colour everywhere, holes included", () => {
  const out = removeBackground(logo(), { r: 255, g: 255, b: 255 }, { tolerance: 20, softness: 10, mode: 'all' });
  assert.equal(alpha(out, 20, 10), 0);
  assert.equal(alpha(out, 12, 6), 255);
});

test('a soft-edge pixel keeps part of its alpha and loses the background tint', () => {
  // Half red, half white: a typical anti-aliased edge pixel.
  const bg: Rgb = { r: 255, g: 255, b: 255 };
  const p = image(5, 1, WHITE);
  const mixed: Rgba = [Math.round((220 + 255) / 2), Math.round((30 + 255) / 2), Math.round((40 + 255) / 2), 255];
  p.data.set(mixed, 2 * 4);
  const d = colorDistance({ r: mixed[0], g: mixed[1], b: mixed[2] }, bg);
  const out = removeBackground(p, bg, { tolerance: d - 60, softness: 120, mode: 'all' });
  const [r, g, b, a] = px(out, 2, 0);
  assert.ok(a > 0 && a < 255, `partial alpha, got ${a}`);
  assert.ok(r > g + 50 && r > b + 50, `un-mixed towards red, got ${[r, g, b]}`);
  assert.ok(g < mixed[1], 'less white than before');
});

test('the input is never modified', () => {
  const p = logo();
  const before = Array.from(p.data);
  removeBackground(p, { r: 255, g: 255, b: 255 }, { tolerance: 20, softness: 10, mode: 'all' });
  cleanLogo(p, { tolerance: 20, softness: 10, mode: 'edges', removeBackground: true });
  assert.deepEqual(Array.from(p.data), before);
});

test('contentBounds and crop trim to the content', () => {
  const p = image(40, 20, CLEAR);
  rect(p, 10, 5, 20, 8, RED);
  const box = contentBounds(p);
  assert.deepEqual(box, { x: 10, y: 5, width: 20, height: 8 });
  const c = crop(p, box!);
  assert.equal(c.width, 20);
  assert.equal(c.height, 8);
  assert.deepEqual(px(c, 0, 0), RED);
  assert.equal(contentBounds(image(4, 4, CLEAR)), null);
});

test('fitInside keeps the aspect inside 512×256 and does not enlarge by default', () => {
  assert.deepEqual(fitInside(1000, 200), { width: 512, height: 102 });
  assert.deepEqual(fitInside(100, 300), { width: 85, height: 256 });
  assert.deepEqual(fitInside(100, 50), { width: 100, height: 50 });
  assert.deepEqual(fitInside(100, 50, 512, 256, { upscale: true }), { width: 512, height: 256 });
  assert.deepEqual(fitInside(0, 50), { width: 0, height: 0 });
  assert.deepEqual(fitInside(5000, 1), { width: 512, height: 1 }, 'never 0 pixels high');
});

test('cleanLogo: a padded JPEG-like logo comes out trimmed on transparency', () => {
  const p = logo();
  // JPEG noise on the white background.
  for (let k = 0; k < p.width * p.height; k += 7) if (p.data[k * 4] > 250) p.data.set([252, 254, 251, 255], k * 4);
  const r = cleanLogo(p, { tolerance: 28, softness: 24, mode: 'edges', removeBackground: true });
  assert.equal(r.empty, false);
  assert.equal(r.background.kind, 'color');
  assert.deepEqual(r.bounds, { x: 10, y: 5, width: 20, height: 10 });
  assert.deepEqual(r.size, { width: 20, height: 10 });
  assert.equal(alpha(r.pixels, 0, 0), 255);
});

test('cleanLogo without removal only trims (nothing to trim on an opaque image)', () => {
  const r = cleanLogo(logo(), { tolerance: 28, softness: 24, mode: 'edges', removeBackground: false });
  assert.deepEqual(r.bounds, { x: 0, y: 0, width: 40, height: 20 });
});

test('a blank image is reported empty, not thrown', () => {
  const r = cleanLogo(image(8, 8, WHITE), { tolerance: 28, softness: 24, mode: 'all', removeBackground: true });
  assert.equal(r.empty, true);
  assert.deepEqual(r.size, { width: 0, height: 0 });
});
