// The sticker collage (packages/ui/components/sticker-collage.ts; D285, D287): a Celebration's sponsor stickers packed
// round the title within the size and tilt thresholds, the same for the same seed, never on an obstacle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAGE_LOOKS,
  boxObstacle,
  cosDeg,
  hullObstacle,
  placedPolygon,
  sinDeg,
  stickerCollage,
  stickerCollagePages,
  type Collage,
  type CollageOptions,
  type CollageSticker,
  type Point,
  type StickerPlacement,
} from '../../../../../packages/ui/components/sticker-collage.ts';

// ---------------------------------------------------------------------------------------------------- the scenes
/** A nino's rough outline (normalised): a figure narrower at its feet, as alphaHull gives one. */
const NINO: Point[] = [
  { x: 0.3, y: 0 },
  { x: 0.75, y: 0.05 },
  { x: 1, y: 0.4 },
  { x: 0.85, y: 1 },
  { x: 0.15, y: 1 },
  { x: 0, y: 0.45 },
];

/** The projector's Quina Celebration as built (1440 × 1080; projector_screens): the tilted «QUINA!», the gold round
 * plate under it, a nino in each corner, the garland across the top. */
const PROJECTOR: CollageOptions = {
  ...COLLAGE_LOOKS.projector,
  region: { x: 32, y: 96, width: 1376, height: 952 },
  obstacles: [
    boxObstacle({ x: 330, y: 168, width: 780, height: 262 }, -5),
    boxObstacle({ x: 555, y: 486, width: 330, height: 132 }, 2),
    hullObstacle(NINO, { x: 40, y: 70, width: 200, height: 236 }, -8),
    hullObstacle(NINO, { x: 1180, y: 80, width: 196, height: 230 }, 9),
    hullObstacle(NINO, { x: 40, y: 746, width: 250, height: 290 }, -4),
    hullObstacle(NINO, { x: 1112, y: 746, width: 260, height: 300 }, 5),
  ],
  focus: { x: 720, y: 720 },
  seed: '3:bingo@1764358800000',
};

/** A phone's Celebration box between the shout and «Tancar» (390 × 844, the panel 342 wide). */
const PHONE: CollageOptions = {
  ...COLLAGE_LOOKS.phone,
  region: { x: 0, y: 0, width: 342, height: 400 },
  focus: { x: 171, y: 0 },
  seed: '3:bingo@1764358800000',
};

/** Logos' shapes as they come: badges, wordmarks, boxes, a tall one; die-cut hulls for some. */
const SHAPES: CollageSticker[] = [
  { id: 'sa-pizza', aspect: 1.05 },
  { id: 'els-perduts', aspect: 1, hull: octagon() },
  { id: 'blauet', aspect: 4.2 },
  { id: 'padel-indians', aspect: 1.35 },
  { id: '141', aspect: 1, hull: octagon() },
  { id: 'bar-de-placa', aspect: 1.6 },
  { id: 'tocineria', aspect: 0.8 },
  { id: 'hotel-classic', aspect: 2.1 },
  { id: 'zig-zag', aspect: 1.2 },
  { id: 'set-vetes', aspect: 2.8 },
  { id: 'figa', aspect: 3.4 },
  { id: 'kumade', aspect: 1.5 },
  { id: 'begu-u', aspect: 1.25 },
  { id: 'can-kai', aspect: 2.4 },
  { id: 'nepoca', aspect: 0.9 },
];

function octagon(): Point[] {
  return Array.from({ length: 8 }, (_, i) => ({ x: 0.5 + 0.5 * cosDeg(i * 45 - 180 + 22.5) / cosDeg(22.5), y: 0.5 + 0.5 * sinDeg(i * 45 - 180 + 22.5) / cosDeg(22.5) }));
}

const hullOf = (p: StickerPlacement, stickers: readonly CollageSticker[]) => placedPolygon(p, stickers[p.index].hull);

// ---------------------------------------------------------------------------------------------------- geometry (independent of the module's SAT)
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function inside(poly: readonly Point[], p: Point): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const s = Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    if (s === 0) continue;
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Whether two convex polygons share any area: an edge crossing, or one inside the other. */
function overlap(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return inside(a, b[0]) || inside(b, a[0]);
}

/** How deep two convex polygons overlap (the least push along an edge normal that parts them); 0 when apart. */
function depth(a: readonly Point[], b: readonly Point[]): number {
  let least = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
      const proj = (s: readonly Point[]) => s.map((v) => v.x * n.x + v.y * n.y);
      const pa = proj(a);
      const pb = proj(b);
      const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (o <= 0) return 0;
      least = Math.min(least, o);
    }
  }
  return least;
}

const containFit = (aspect: number, box: { width: number; height: number }) =>
  aspect >= box.width / box.height ? { width: box.width, height: box.width / aspect } : { width: box.height * aspect, height: box.height };

/** Every rule a collage keeps, checked from the outside. */
function checkCollage(c: Collage, stickers: readonly CollageSticker[], o: CollageOptions): void {
  const region = { ...o.region, height: c.height };
  const polys = c.placed.map((p) => hullOf(p, stickers));
  c.placed.forEach((p, k) => {
    const poly = polys[k];
    for (const q of poly) {
      assert.ok(q.x >= region.x - 1e-6 && q.x <= region.x + region.width + 1e-6 && q.y >= region.y - 1e-6 && q.y <= region.y + region.height + 1e-6, `${p.id} leaves the region`);
    }
    for (const ob of o.obstacles ?? []) assert.ok(!overlap(poly, ob.points), `${p.id} touches an obstacle`);
    // sizes: at least the floor's contain-fit, at most the ceiling's
    const aspect = stickers[p.index].aspect;
    const least = containFit(aspect, o.floor);
    assert.ok(p.width >= least.width - 1e-6, `${p.id} is ${p.width.toFixed(1)} wide`);
    assert.ok(Math.max(p.width, p.height) <= Math.max(o.ceiling.side, least.width, least.height) + 1e-6, `${p.id} is ${p.width.toFixed(1)} wide`);
    const floorShaped = (o.floor.width / o.floor.height) * o.ceiling.unit ** 2 * o.favour * (1 + o.variety) ** 2;
    assert.ok(p.width * p.height <= floorShaped + 1e-6, `${p.id} is over the ceiling's area`);
    assert.ok(Math.abs(p.width / p.height - aspect) < 1e-9, `${p.id} keeps its shape`);
    // tilts: within the range, a wide one's ends rising at most `rise` of its height
    const tilt = Math.abs(p.rotation);
    assert.ok(tilt <= o.tilt.max + 1e-9, `${p.id} tilts ${tilt}°`);
    assert.ok((aspect / 2) * sinDeg(tilt) <= o.tilt.rise + 1e-3, `${p.id}'s ends rise too much`);
    assert.ok(tilt >= Math.min(o.tilt.min, 1) / 2 - 1e-9, `${p.id} is tilted (${tilt}°)`);
  });
  // stickers overlap at most into each other's rims
  for (let a = 0; a < polys.length; a++) {
    for (let b = a + 1; b < polys.length; b++) assert.ok(depth(polys[a], polys[b]) <= Math.max(0, -o.gap) + 1e-6, `${c.placed[a].id} and ${c.placed[b].id} overlap`);
  }
  // the entry order: 0 first, every order once
  assert.deepEqual(c.placed.map((p) => p.order), c.placed.map((_, i) => i));
}

// ---------------------------------------------------------------------------------------------------- the tests
for (const n of [1, 2, 3, 5, 6, 10, 15]) {
  test(`projector, ${n} sticker(s): inside the region, off every obstacle, within the size and tilt thresholds`, () => {
    const stickers = SHAPES.slice(0, n);
    const pages = stickerCollagePages(stickers, PROJECTOR);
    const all = pages.flatMap((p) => p.placed.map((s) => s.index)).sort((a, b) => a - b);
    assert.deepEqual(all, stickers.map((_, i) => i), 'every sticker on exactly one page');
    for (const page of pages) checkCollage(page, stickers, PROJECTOR);
    if (n <= 6) assert.equal(pages.length, 1, 'up to six fit at once');
  });

  test(`phone, ${n} sticker(s): one collage that grows downward when needed, every rule kept`, () => {
    const stickers = SHAPES.slice(0, n);
    const c = stickerCollage(stickers, { ...PHONE, grow: 1600 });
    assert.equal(c.overflow.length, 0);
    assert.equal(c.placed.length, n);
    checkCollage(c, stickers, PHONE);
  });
}

test('the same seed draws the same collage; another seed another one', () => {
  const stickers = SHAPES.slice(0, 6);
  const a = stickerCollage(stickers, PROJECTOR);
  assert.deepEqual(stickerCollage(stickers, { ...PROJECTOR }), a);
  const b = stickerCollage(stickers, { ...PROJECTOR, seed: '4:line@1764359900000' });
  assert.notDeepEqual(b.placed, a.placed);
});

test('fewer sponsors, bigger stickers', () => {
  const units = [1, 3, 6, 10].map((n) => stickerCollagePages(SHAPES.slice(0, n), PROJECTOR)[0].unit);
  for (let i = 1; i < units.length; i++) assert.ok(units[i] <= units[i - 1], `${units}`);
  assert.ok(units[0] > units[1] && units[0] >= 1.6 * PROJECTOR.floor.height, `one sponsor is the biggest: ${units}`);
  // on a free region one sponsor takes the ceiling
  assert.equal(stickerCollage(SHAPES.slice(0, 1), { ...PROJECTOR, obstacles: [] }).unit, PROJECTOR.ceiling.unit);
});

test('the headline sponsor (first in plan order) enters first and is never smaller than the others', () => {
  const stickers = SHAPES.slice(0, 6).map((s) => ({ ...s, aspect: 1.5, hull: null }));
  const c = stickerCollage(stickers, PROJECTOR);
  const head = c.placed.find((p) => p.index === 0)!;
  assert.equal(head.order, 0);
  for (const p of c.placed) if (p !== head) assert.ok(head.width * head.height >= p.width * p.height * 0.97, `${p.id}`);
});

test('every sticker gets the same area, so a wordmark is as big as a badge (within the seeded variety)', () => {
  const stickers: CollageSticker[] = [{ id: 'head', aspect: 1.6 }, { id: 'badge', aspect: 1 }, { id: 'wordmark', aspect: 4 }];
  const c = stickerCollage(stickers, { ...PROJECTOR, favour: 1, variety: 0, region: { x: 0, y: 0, width: 4000, height: 4000 }, obstacles: [], focus: undefined, ceiling: { unit: 200, side: 1000 } });
  assert.equal(c.unit, 200);
  const areas = c.placed.map((p) => p.width * p.height);
  for (const a of areas) assert.ok(Math.abs(a - areas[0]) < 1e-6 * areas[0], `${areas}`);
});

test("a very wide or very tall logo still fits, its tilt kept small enough that its ends don't rise", () => {
  const stickers: CollageSticker[] = [{ id: 'wide', aspect: 8 }, { id: 'tall', aspect: 0.25 }, { id: 'badge', aspect: 1 }];
  const c = stickerCollage(stickers, PROJECTOR);
  assert.equal(c.placed.length, 3);
  checkCollage(c, stickers, PROJECTOR);
  const wide = c.placed.find((p) => p.id === 'wide')!;
  assert.ok(Math.abs(wide.rotation) < 4, `${wide.rotation}`);
});

test('the group stays balanced round the focus: its weight over the focus, both sides used', () => {
  for (const n of [5, 6, 10]) {
    const c = stickerCollagePages(SHAPES.slice(0, n), PROJECTOR)[0];
    const area = c.placed.reduce((s, p) => s + p.width * p.height, 0);
    const cx = c.placed.reduce((s, p) => s + p.x * p.width * p.height, 0) / area;
    assert.ok(Math.abs(cx - PROJECTOR.focus!.x) < PROJECTOR.region.width * 0.08, `${n}: centred at ${cx.toFixed(0)}`);
    assert.ok(c.placed.some((p) => p.x < PROJECTOR.focus!.x - 100) && c.placed.some((p) => p.x > PROJECTOR.focus!.x + 100), `${n}: both sides`);
  }
});

test('the tilts alternate sides in plan order, so neighbours lean apart', () => {
  const c = stickerCollage(SHAPES.slice(0, 6).map((s) => ({ ...s, aspect: 1.2 })), PROJECTOR);
  const byIndex = [...c.placed].sort((a, b) => a.index - b.index);
  const signs = byIndex.map((p) => Math.sign(p.rotation));
  // the planned tilt alternates; a sticker may take its mirror image when only that fits, so most still alternate
  const alternations = signs.slice(1).filter((s, i) => s !== signs[i]).length;
  assert.ok(alternations >= 3, `${signs}`);
});

test('more than fit at the floor: pages in plan order, the later ones never bigger', () => {
  const small: CollageOptions = { ...PROJECTOR, region: { x: 0, y: 0, width: 700, height: 420 }, obstacles: [], focus: undefined };
  const pages = stickerCollagePages(SHAPES, small);
  assert.ok(pages.length >= 2);
  assert.ok(pages[0].placed.some((p) => p.index === 0), 'the headline on the first page');
  const firsts = pages.map((p) => Math.min(...p.placed.map((s) => s.index)));
  for (let i = 1; i < firsts.length; i++) assert.ok(firsts[i] > firsts[i - 1]);
  for (const page of pages) {
    assert.ok(page.unit <= pages[0].unit + 1e-9);
    checkCollage(page, SHAPES, small);
  }
});

test('a phone grows the region downward only when the floor needs it', () => {
  const few = stickerCollage(SHAPES.slice(0, 3), { ...PHONE, grow: 1600 });
  assert.equal(few.height, PHONE.region.height);
  const many = stickerCollage(SHAPES, { ...PHONE, grow: 1600 });
  assert.ok(many.height > PHONE.region.height);
  assert.ok(many.unit < PHONE.floor.height * 1.05, 'grown just enough to place them all near the floor');
  const none = stickerCollage(SHAPES, PHONE);
  assert.ok(none.overflow.length > 0, 'without grow the rest wait for a page');
});

test('nothing to place, or nowhere to place it', () => {
  assert.deepEqual(stickerCollage([], PROJECTOR).placed, []);
  const tiny = stickerCollage(SHAPES.slice(0, 2), { ...PROJECTOR, region: { x: 0, y: 0, width: 100, height: 80 }, obstacles: [] });
  assert.deepEqual(tiny.placed, []);
  assert.deepEqual(tiny.overflow, [0, 1]);
  assert.deepEqual(stickerCollagePages(SHAPES.slice(0, 2), { ...PROJECTOR, region: { x: 0, y: 0, width: 100, height: 80 }, obstacles: [] }), []);
});

test("its own sine and cosine agree with Math's to 1e-12 over the tilts", () => {
  for (let d = -30; d <= 30; d += 0.25) {
    assert.ok(Math.abs(sinDeg(d) - Math.sin((d * Math.PI) / 180)) < 1e-12);
    assert.ok(Math.abs(cosDeg(d) - Math.cos((d * Math.PI) / 180)) < 1e-12);
  }
});

test('the time budget: once per Celebration, well inside the title slam before the stickers enter', () => {
  const runs: number[] = [];
  for (const n of [5, 10, 15]) {
    const t0 = performance.now();
    stickerCollagePages(SHAPES.slice(0, n), PROJECTOR);
    runs.push(performance.now() - t0);
  }
  // About 10–40 ms on a laptop (28 Nov); a mid phone is about four times slower. The stickers enter at 900 ms.
  assert.ok(Math.max(...runs) < 400, `${runs.map((ms) => ms.toFixed(1))} ms`);
});
