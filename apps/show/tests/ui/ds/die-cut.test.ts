// A sponsor's logo as a die-cut sticker (packages/ui/components/die-cut.ts; D285, D287): the white backing follows
// the logo's outline with its holes filled and its letter gaps bridged, and the logo's own pixels are never changed
// (the Orchestrator's rule, 28 Nov: no recolouring, no tint, no filter on the logo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alphaHull, convexHull, dieCut, DIE_CUT, type RgbaPixels } from '../../../../../packages/ui/components/die-cut.ts';

/** A test logo: `paint(x, y)` gives a pixel's RGBA or null for transparent. */
function logo(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number] | null): RgbaPixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = paint(x, y);
      if (px) data.set(px, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const at = (p: RgbaPixels, x: number, y: number) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];

/** A ring (a hole in the middle) and two bars with a narrow gap between them, in brand colours with a soft edge. */
const RING_AND_BARS = logo(400, 200, (x, y) => {
  const r = Math.hypot(x - 100, y - 100);
  if (r > 55 && r < 85) return [200, 30, 60, 255];
  if (r >= 85 && r < 86) return [200, 30, 60, 128];
  if (x >= 220 && x < 260 && y >= 30 && y < 170) return [20, 90, 200, 255];
  if (x >= 272 && x < 312 && y >= 30 && y < 170) return [240, 180, 0, 255];
  return null;
});

test("the logo's own pixels are never changed: every opaque pixel keeps its exact colour", () => {
  const cut = dieCut(RING_AND_BARS);
  let checked = 0;
  for (let y = 0; y < RING_AND_BARS.height; y++) {
    for (let x = 0; x < RING_AND_BARS.width; x++) {
      const src = at(RING_AND_BARS, x, y);
      if (src[3] !== 255) continue;
      assert.deepEqual(at(cut.pixels, cut.logo.x + x, cut.logo.y + y), src);
      checked++;
    }
  }
  assert.ok(checked > 10_000);
});

test('a soft edge is the logo over white, never tinted another way', () => {
  const cut = dieCut(RING_AND_BARS);
  // the ring's half-transparent edge: half its colour, half the white backing under it
  const [r, g, b, a] = at(cut.pixels, cut.logo.x + 100 + 85, cut.logo.y + 100);
  assert.equal(a, 255);
  assert.ok(Math.abs(r - (200 + 255) / 2) <= 1 && Math.abs(g - (30 + 255) / 2) <= 1 && Math.abs(b - (60 + 255) / 2) <= 1, `${[r, g, b]}`);
});

test('the hole inside the ring is filled white, and the gap between letters is bridged', () => {
  const cut = dieCut(RING_AND_BARS);
  assert.deepEqual(at(cut.pixels, cut.logo.x + 100, cut.logo.y + 100), [255, 255, 255, 255]);
  assert.deepEqual(at(cut.pixels, cut.logo.x + 266, cut.logo.y + 100), [255, 255, 255, 255]);
  // and the bridge holds right up to the bars' tops, as a smooth cut
  assert.equal(at(cut.pixels, cut.logo.x + 266, cut.logo.y + 31)[3], 255);
});

test('the white rim reaches about 5 % of the longer side beyond the logo, and the cut is antialiased', () => {
  const cut = dieCut(RING_AND_BARS);
  const rim = Math.round(400 * DIE_CUT.rim);
  const right = cut.logo.x + 312; // just past the right bar
  assert.equal(at(cut.pixels, right + rim - 2, cut.logo.y + 100)[3], 255);
  assert.equal(at(cut.pixels, right + rim + 2, cut.logo.y + 100)[3], 0);
  const edge = at(cut.pixels, right + rim, cut.logo.y + 100)[3];
  assert.ok(edge > 0 && edge < 255, `the cut line's pixel is part-covered: ${edge}`);
  // cropped to the cut with 2 px to spare
  assert.equal(cut.pixels.width, right + rim + 3);
});

test("a boxed logo (a JPEG, opaque to its edges) gets a rounded die-cut: the box's corners stay clear", () => {
  const box = logo(300, 150, () => [10, 10, 10, 255]);
  const cut = dieCut(box);
  assert.equal(at(cut.pixels, 0, 0)[3], 0);
  assert.equal(at(cut.pixels, cut.pixels.width - 1, cut.pixels.height - 1)[3], 0);
  assert.deepEqual(at(cut.pixels, cut.logo.x, cut.logo.y), [10, 10, 10, 255]);
});

test('the hull holds every pixel of the cut, is convex, and keeps at most 16 points', () => {
  const cut = dieCut(RING_AND_BARS);
  const { width: w, height: h } = cut.pixels;
  const hull = cut.hull.map((p) => ({ x: p.x * w, y: p.y * h }));
  assert.ok(hull.length >= 3 && hull.length <= DIE_CUT.hullPoints);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  for (let i = 0; i < hull.length; i++) {
    // clockwise on screen: every turn the same way (y down, so the cross product is positive)
    assert.ok(cross(hull[i], hull[(i + 1) % hull.length], hull[(i + 2) % hull.length]) > 0);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(cut.pixels, x, y)[3] <= 64) continue;
      for (const corner of [{ x, y }, { x: x + 1, y: y + 1 }]) {
        for (let i = 0; i < hull.length; i++) assert.ok(cross(hull[i], hull[(i + 1) % hull.length], corner) >= -1e-6, `pixel ${x},${y} outside the hull`);
      }
    }
  }
});

test('a logo in parts too far apart for the closing still makes one sticker: one cut round them all', () => {
  // two wordmarks one above the other with a wide gap (a logo sheet with two versions)
  const sheet = logo(200, 300, (x, y) => (x >= 20 && x < 180 && ((y >= 10 && y < 60) || (y >= 240 && y < 290)) ? [0, 0, 0, 255] : null));
  const cut = dieCut(sheet);
  // the gap between them is white backing, opaque
  assert.deepEqual(at(cut.pixels, cut.logo.x + 100, cut.logo.y + 150), [255, 255, 255, 255]);
});

test('an empty logo makes no sticker', () => {
  const cut = dieCut(logo(40, 20, () => null));
  assert.equal(cut.pixels.width, 0);
  assert.deepEqual(cut.hull, []);
  assert.deepEqual(alphaHull({ width: 0, height: 0, data: new Uint8ClampedArray(0) }), []);
});

test('convexHull drops the inner and collinear points', () => {
  const hull = convexHull([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
    { x: 2, y: 2 },
  ]);
  assert.equal(hull.length, 4);
});

test('a 512 × 256 logo (Admin keeps logos within that) is cut fast enough to make them all while the round plays', () => {
  const big = logo(512, 256, (x, y) => (Math.hypot(x - 128, y - 128) < 110 || (x > 280 && x < 500 && y > 60 && y < 200) ? [0, 0, 0, 255] : null));
  dieCut(big);
  const t0 = performance.now();
  dieCut(big);
  const ms = performance.now() - t0;
  // About 20 ms on a laptop (28 Nov); the budget leaves room for a slow CI.
  assert.ok(ms < 250, `${ms.toFixed(1)} ms`);
});
