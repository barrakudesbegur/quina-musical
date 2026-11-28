// G4 · the sticker collage (D285, D287): a Celebration's sponsor stickers slapped together on the screen, packed by
// their die-cut shapes into the free space round the title (the user, 28 Nov: "places them together dynamically based
// on their sizes and space available (including around the QUINA! in the projector, not just under it), and within
// some rotation and size thresholds"). The projector (apps/stage) and the phones (apps/player) both lay out with it.
//
// How: every sticker gets the same area (a wide wordmark as much as a round badge, so neither reads smaller), the
// first in plan order (the headline prize's sponsor) a little more, each a seeded touch bigger or smaller and a seeded
// tilt, alternating sides, that a wide logo keeps small. For one size unit the stickers go in one at a time, the
// headline first, each where it sits closest to the focus (under the title) without touching an obstacle or another
// sticker beyond the rims, keeping the group's weight centred; a coarse grid of spots, then a fine one round the best.
// The unit is the largest that places them all, between the floor (readable from the back of the room) and the
// ceiling, found by bisection. When even the floor can't place them all, the first that fit make a page and the rest
// wait for the next (as `sponsor-pages`), or, on a phone, the region grows downward and the screen scrolls.
//
// Pure and deterministic: no DOM, no clock, no Math.random. The same seed (the Celebration's key) draws the same
// collage on every reload, and on every engine (its own sine, so V8 and Safari agree to the bit).

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageSticker {
  /** Carried to its placement (the sponsor's id). */
  id: string;
  /** The sticker image's width ÷ height. */
  aspect: number;
  /** Its die-cut's convex hull in the image's box, normalised to 0–1 (die-cut.ts `hull`); none: the whole box. */
  hull?: readonly Point[] | null;
}

/** Something the stickers keep off: a convex polygon in the region's px (a tilted title's corners, a nino's hull). */
export interface CollageObstacle {
  points: readonly Point[];
}

export interface CollageLook {
  /** The readability floor: every sticker at least fills this box (contain), as a logo on a LogoTile of this size. */
  floor: { width: number; height: number };
  /** The most a sticker may take: the size unit never passes `unit` (a sticker shaped like the floor box is then
   * `unit` high), and no sticker's side is ever longer than `side` (a wide wordmark, a tall logo). */
  ceiling: { unit: number; side: number };
  /** Degrees each way. `rise`: a tilt never lifts a sticker's end by more than this share of its height, so a wide
   * wordmark tilts less than a badge. */
  tilt: { min: number; max: number; rise: number };
  /** Between stickers, px; negative lets the white rims overlap (never the logos: the rim is wider). */
  gap: number;
  /** From the obstacles and the region's edges, px. */
  clearance: number;
  /** The first sticker's (the headline prize's sponsor) area, × this. */
  favour: number;
  /** Each sticker's size, ± this share (seeded), so the collage looks slapped on by hand. */
  variety: number;
}

export interface CollageOptions extends CollageLook {
  /** The box to fill, px. */
  region: Box;
  obstacles?: readonly CollageObstacle[];
  /** Where the collage grows from (default: the region's centre); the headline takes the spot nearest it. */
  focus?: Point;
  /** The same seed draws the same collage: the Celebration's key. */
  seed: string;
  /** When the floor can't place them all, the region may grow downward to this height (a phone's screen scrolls);
   * without it the rest overflow to the next page. */
  grow?: number;
  /** The largest size unit allowed (a later page keeps the first page's). */
  maxUnit?: number;
}

export interface StickerPlacement {
  id: string;
  /** Its index in the input (the plan's order). */
  index: number;
  /** Its centre, px, in the region's coordinates. */
  x: number;
  y: number;
  /** The image's box, px, before the tilt. */
  width: number;
  height: number;
  /** Degrees, clockwise (CSS `rotate`), about the centre. */
  rotation: number;
  /** When it enters and how it stacks: 0 first and lowest (the headline), then outward from it. */
  order: number;
}

export interface Collage {
  /** In entry order. */
  placed: StickerPlacement[];
  /** Input indices that didn't fit even at the floor: the next page's. */
  overflow: number[];
  /** The size unit it settled on: the height of a sticker shaped like the floor box (px). */
  unit: number;
  /** The region's height it used (more than asked when it grew). */
  height: number;
}

/**
 * The two screens' looks (28 Nov). Projector: the floor is the SponsorStrip's 240 × 150 tile, agreed readable from the
 * back of the room (the board's rule); the ceiling twice the floor (a single sponsor at 480 × 300, the size the board's
 * one-sponsor tile had), no side over 560 px (under 40 % of the screen). Phone: the floor 112 × 70, the design system's
 * 68–70 px phone logo tile (components-v2.md › G4), which at reading distance is about twice the visual angle of the
 * projector's floor from the back row, and three still fit across a 390 px phone; the ceiling 288 × 180, no side over
 * 300 px (the panel is 342). Tilts 3–9°, the ninos' own range; a wordmark's ends rise at most a
 * quarter of its height. The rims may overlap a little (6 px, 3 px on a phone; a rim is 5 % of a logo, over 10 px at
 * the floor), so they read as stickers slapped on one surface, every logo whole.
 */
export const COLLAGE_LOOKS = Object.freeze({
  projector: Object.freeze<CollageLook>({
    floor: { width: 240, height: 150 },
    ceiling: { unit: 300, side: 560 },
    tilt: { min: 3, max: 9, rise: 0.25 },
    gap: -6,
    clearance: 14,
    favour: 1.3,
    variety: 0.07,
  }),
  phone: Object.freeze<CollageLook>({
    floor: { width: 112, height: 70 },
    ceiling: { unit: 180, side: 300 },
    tilt: { min: 3, max: 9, rise: 0.25 },
    gap: -3,
    clearance: 6,
    favour: 1.3,
    variety: 0.07,
  }),
});

/** The whole box as a hull, for a sticker that has none yet (a sponsor with no logo: its name on a tile). */
const BOX_HULL: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** The collage for one page: as many stickers as fit, in plan order, the rest in `overflow`. */
export function stickerCollage(stickers: readonly CollageSticker[], options: CollageOptions): Collage {
  const plan = stickerPlan(stickers, options);
  const region = options.region;
  if (!stickers.length) return { placed: [], overflow: [], unit: 0, height: region.height };
  const lo = options.floor.height;
  const hi = Math.max(lo, Math.min(options.ceiling.unit, options.maxUnit ?? Infinity));
  const all = plan.map((_, i) => i);
  const attempt = (unit: number, ids: readonly number[], box: Box) => place(plan, ids, unit, box, options);
  // Above the floor a unit must also compose well: the headline on the focus (its outline within reach of it, its
  // centre over it), so one big sticker sits under the title instead of being pushed aside by its own size; and from
  // three stickers the group's weight over the focus, so no side stays empty. At the floor anywhere will do.
  const centred = (unit: number, ids: readonly number[], box: Box) => {
    const got = attempt(unit, ids, box);
    const head = got?.find((p) => p.index === 0);
    if (!got || !head) return null;
    const focus = options.focus ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const reach = reachOf(box);
    if (distanceTo(placedPolygon(head, plan[0].hull), focus) > reach || Math.abs(head.x - focus.x) > reach) return null;
    if (got.length >= 3) {
      const area = got.reduce((s, p) => s + p.width * p.height, 0);
      const cx = got.reduce((s, p) => s + p.x * p.width * p.height, 0) / area;
      if (Math.abs(cx - focus.x) > BALANCE * box.width) return null;
    }
    return got;
  };
  const finish = (placed: StickerPlacement[], box: Box) => entryOrder(settle(plan, placed, box, options));

  // Everything fits at the floor: the largest unit that still places them all.
  let box = region;
  let atFloor = attempt(lo, all, box);
  if (!atFloor && options.grow && options.grow > region.height) {
    const step = Math.max(8, Math.round(region.width / 8));
    let h = region.height;
    while (!atFloor && h < options.grow) {
      h = Math.min(options.grow, h + step);
      box = { ...region, height: h };
      atFloor = attempt(lo, all, box);
    }
  }
  if (atFloor) {
    const { unit, placed } = largest(lo, hi, atFloor, (u) => centred(u, all, box));
    return { placed: finish(placed, box), overflow: [], unit, height: box.height };
  }

  // A page: the longest run of the plan's order that fits at the floor (the headline first, always).
  let k = 0;
  let best: StickerPlacement[] = [];
  let left = 1;
  let right = plan.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    const got = attempt(lo, all.slice(0, mid), box);
    if (got) {
      k = mid;
      best = got;
      left = mid + 1;
    } else right = mid - 1;
  }
  if (!k) return { placed: [], overflow: all, unit: lo, height: box.height };
  const ids = all.slice(0, k);
  const { unit, placed } = largest(lo, hi, best, (u) => centred(u, ids, box));
  return { placed: finish(placed, box), overflow: all.slice(k), unit, height: box.height };
}

/** Every page, each the next run of the plan's order, the later ones never bigger than the first. */
export function stickerCollagePages(stickers: readonly CollageSticker[], options: CollageOptions): Collage[] {
  const pages: Collage[] = [];
  let rest = stickers.map((s, i) => ({ s, i }));
  let maxUnit = options.maxUnit;
  while (rest.length) {
    const page = stickerCollage(
      rest.map((r) => r.s),
      { ...options, maxUnit, seed: pages.length ? `${options.seed}#${pages.length + 1}` : options.seed },
    );
    if (!page.placed.length) break;
    pages.push({ ...page, placed: page.placed.map((p) => ({ ...p, index: rest[p.index].i })), overflow: page.overflow.map((i) => rest[i].i) });
    maxUnit ??= page.unit;
    rest = page.overflow.map((i) => rest[i]);
  }
  return pages;
}

/** A sticker's outline as placed: its hull (or its box) tilted and moved to its spot, px. */
export function placedPolygon(p: Pick<StickerPlacement, 'x' | 'y' | 'width' | 'height' | 'rotation'>, hull?: readonly Point[] | null): Point[] {
  const c = cosDeg(p.rotation);
  const s = sinDeg(p.rotation);
  return (hull?.length ? hull : BOX_HULL).map((q) => {
    const dx = (q.x - 0.5) * p.width;
    const dy = (q.y - 0.5) * p.height;
    return { x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c };
  });
}

/** An obstacle from a box tilted about its centre (a title rotated −5°, a plate rotated 2°), as CSS draws it. */
export function boxObstacle(box: Box, rotation = 0): CollageObstacle {
  return { points: placedPolygon({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height, rotation }) };
}

/** An obstacle from an image's hull (a nino's, alphaHull) drawn in `box`, tilted about its centre. */
export function hullObstacle(hull: readonly Point[], box: Box, rotation = 0): CollageObstacle {
  return { points: placedPolygon({ x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width, height: box.height, rotation }, hull) };
}

// ---------------------------------------------------------------------------------------------------- the plan
interface Planned {
  id: string;
  aspect: number;
  hull: readonly Point[];
  /** Area weight: the favour and the variety. */
  weight: number;
  /** Its seeded tilt, degrees. */
  tilt: number;
}

/** Each sticker's area weight and tilt, from the seed. */
function stickerPlan(stickers: readonly CollageSticker[], o: CollageOptions): Planned[] {
  const random = mulberry32(hashString(o.seed));
  const side = random() < 0.5 ? -1 : 1;
  return stickers.map((s, i) => {
    const aspect = Number.isFinite(s.aspect) && s.aspect > 0 ? s.aspect : 1;
    const size = 1 + o.variety * (2 * random() - 1);
    // A tilt that lifts a wide sticker's end by at most `rise` of its height: sin θ ≤ 2·rise / aspect.
    const most = Math.min(o.tilt.max, asinDeg(Math.min(1, (2 * o.tilt.rise) / aspect)));
    const least = Math.min(o.tilt.min, most / 2);
    const tilt = (i % 2 ? -side : side) * (least + (most - least) * random());
    return { id: s.id, aspect, hull: s.hull?.length ? s.hull : BOX_HULL, weight: (i === 0 ? o.favour : 1) * size * size, tilt };
  });
}

/** A sticker's box at a size unit: the floor box's area × unit², times its weight, shaped by its aspect; no side over
 * the ceiling's, and never under its contain-fit in the floor box (the floor wins: readable first). */
function sizeAt(p: Planned, unit: number, o: CollageLook): { width: number; height: number } {
  const floorAspect = o.floor.width / o.floor.height;
  const area = floorAspect * unit * unit * p.weight;
  let width = Math.sqrt(area * p.aspect);
  let height = width / p.aspect;
  const side = Math.max(width, height);
  if (side > o.ceiling.side) {
    width *= o.ceiling.side / side;
    height *= o.ceiling.side / side;
  }
  const least = contain(p.aspect, o.floor);
  if (width < least.width) ({ width, height } = least);
  return { width, height };
}

const contain = (aspect: number, box: { width: number; height: number }) =>
  aspect >= box.width / box.height ? { width: box.width, height: box.width / aspect } : { width: box.height * aspect, height: box.height };

/** Bisect the size unit between a unit that places them (`lo`, placed as `got`) and `hi`. */
function largest(lo: number, hi: number, got: StickerPlacement[], at: (unit: number) => StickerPlacement[] | null): { unit: number; placed: StickerPlacement[] } {
  const top = hi > lo ? at(hi) : null;
  if (top) return { unit: hi, placed: top };
  let a = lo;
  let b = hi;
  let best = got;
  // to within 1 % of the floor: about eight attempts
  while (b - a > lo * 0.01) {
    const mid = (a + b) / 2;
    const placed = at(mid);
    if (placed) {
      a = mid;
      best = placed;
    } else b = mid;
  }
  return { unit: a, placed: best };
}

/** The headline first, then outward from it: the order they slap on and stack in. */
function entryOrder(placed: StickerPlacement[]): StickerPlacement[] {
  const head = placed.find((p) => p.index === 0) ?? placed[0];
  const dist = (p: StickerPlacement) => (p === head ? -1 : (p.x - head.x) ** 2 + (p.y - head.y) ** 2);
  return [...placed].sort((a, b) => dist(a) - dist(b) || a.index - b.index).map((p, order) => ({ ...p, order }));
}

// ---------------------------------------------------------------------------------------------------- the placing
/** A fixed convex shape with its edge normals and its extent along them. */
interface Shape {
  points: readonly Point[];
  axes: Point[];
  ranges: [number, number][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeOf(points: readonly Point[]): Shape {
  const axes = normals(points);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const q of points) {
    if (q.x < minX) minX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x;
    if (q.y > maxY) maxY = q.y;
  }
  return { points, axes, ranges: axes.map((n) => extent(points, n)), minX, minY, maxX, maxY };
}

function normals(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1e-9) out.push({ x: -dy / len, y: dx / len });
  }
  return out;
}

function extent(points: readonly Point[], n: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const q of points) {
    const d = q.x * n.x + q.y * n.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/**
 * A sticker at one size and tilt, against the fixed shapes: its outline relative to its centre, and for each fixed
 * shape the separating axes with both extents, so a spot costs only additions to test.
 */
class Mover {
  readonly offsets: Point[];
  readonly box: { minX: number; minY: number; maxX: number; maxY: number };
  private readonly axes: Point[];
  private readonly own: [number, number][];

  constructor(hull: readonly Point[], width: number, height: number, rotation: number) {
    this.offsets = placedPolygon({ x: 0, y: 0, width, height, rotation }, hull);
    const s = shapeOf(this.offsets);
    this.box = { minX: s.minX, minY: s.minY, maxX: s.maxX, maxY: s.maxY };
    this.axes = s.axes;
    this.own = s.ranges;
  }

  /** The test against one fixed shape: the axes to check and both extents on each (the mover's relative to its centre). */
  against(shape: Shape): { axes: Point[]; mine: [number, number][]; theirs: [number, number][] } {
    const axes = [...this.axes, ...shape.axes];
    const mine = [...this.own, ...shape.axes.map((n) => extent(this.offsets, n))];
    const theirs = [...this.axes.map((n) => extent(shape.points, n)), ...shape.ranges];
    return { axes, mine, theirs };
  }
}

interface Test {
  shape: Shape;
  gap: number;
  axes: Point[];
  mine: [number, number][];
  theirs: [number, number][];
}

/** Clear of the shape by `gap` along some axis (a negative gap allows that much overlap). */
function clear(t: Test, cx: number, cy: number, box: Mover['box']): boolean {
  if (cx + box.maxX + t.gap <= t.shape.minX || t.shape.maxX + t.gap <= cx + box.minX) return true;
  if (cy + box.maxY + t.gap <= t.shape.minY || t.shape.maxY + t.gap <= cy + box.minY) return true;
  for (let i = 0; i < t.axes.length; i++) {
    const n = t.axes[i];
    const at = cx * n.x + cy * n.y;
    if (t.mine[i][1] + at + t.gap <= t.theirs[i][0] || t.theirs[i][1] + t.gap <= t.mine[i][0] + at) return true;
  }
  return false;
}

/** One attempt: place `ids` (the plan's indices) at a size unit, or null when one of them finds no spot. */
function place(plan: readonly Planned[], ids: readonly number[], unit: number, region: Box, o: CollageOptions): StickerPlacement[] | null {
  const focus = o.focus ?? { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  const obstacles = (o.obstacles ?? []).filter((ob) => ob.points.length >= 3).map((ob) => shapeOf(ob.points));
  const fixed: { shape: Shape; gap: number }[] = obstacles.map((shape) => ({ shape, gap: o.clearance }));
  const placed: StickerPlacement[] = [];
  // The headline first, then the longest (hardest to fit) first; ties in plan order.
  const sizes = new Map(ids.map((i) => [i, sizeAt(plan[i], unit, o)]));
  const order = [...ids].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : 0) || longest(sizes.get(b)!) - longest(sizes.get(a)!) || a - b);
  let weightX = 0;
  let weight = 0;
  for (const i of order) {
    const p = plan[i];
    const { width, height } = sizes.get(i)!;
    const score = scorer(focus, region, weightX, weight, width * height, `${o.seed}|${i}`);
    let spot: { x: number; y: number; rotation: number } | null = null;
    // its own tilt; if no spot takes it, its mirror image, then half of it
    for (const rotation of [p.tilt, -p.tilt, p.tilt / 2]) {
      const found = bestSpot(new Mover(p.hull, width, height, rotation), fixed, region, o.clearance, score);
      if (found) {
        spot = { ...found, rotation };
        break;
      }
    }
    if (!spot) return null;
    const placement = { id: p.id, index: i, x: spot.x, y: spot.y, width, height, rotation: spot.rotation, order: 0 };
    placed.push(placement);
    fixed.push({ shape: shapeOf(placedPolygon(placement, p.hull)), gap: o.gap });
    weightX += spot.x * width * height;
    weight += width * height;
  }
  return placed;
}

const longest = (s: { width: number; height: number }) => Math.max(s.width, s.height);

/** How far from the focus the headline's outline may stay when the unit is above the floor: 8 % of the region's
 * diagonal (about 135 px on the projector, 40 on a phone). */
const reachOf = (region: Box) => 0.08 * Math.sqrt(region.width * region.width + region.height * region.height);

/** From a point to a convex polygon (either winding): 0 inside it, else to its nearest edge. */
function distanceTo(poly: readonly Point[], p: Point): number {
  let left = false;
  let right = false;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const side = ex * (p.y - a.y) - ey * (p.x - a.x);
    if (side < 0) left = true;
    if (side > 0) right = true;
    const len = ex * ex + ey * ey;
    const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len)) : 0;
    best = Math.min(best, Math.sqrt((a.x + t * ex - p.x) ** 2 + (a.y + t * ey - p.y) ** 2));
  }
  return left && right ? best : 0;
}

/** The score a spot gets: near the focus, the group's weight over it, a little seeded noise. Lower is better. */
function scorer(focus: Point, region: Box, weightX: number, weight: number, area: number, key: string): (x: number, y: number) => number {
  const span = Math.sqrt(region.width * region.width + region.height * region.height);
  const seed = hashString(key);
  return (x, y) => {
    const d = Math.sqrt((x - focus.x) ** 2 + (y - focus.y) ** 2) / span;
    const lean = Math.abs((weightX + x * area) / (weight + area) - focus.x) / region.width;
    return d + LEAN * lean + NOISE * noise(seed, Math.round(x), Math.round(y));
  };
}

/** How much the group's balance counts against nearness (1.5: a sticker crosses to the lighter side rather than
 * crowd one), and the seeded noise (so each Celebration draws its own collage without loosening it). */
const LEAN = 1.5;
/** Above the floor, the group's weight stays within this share of the region's width from the focus (110 px on the
 * projector). */
const BALANCE = 0.08;
const NOISE = 0.025;

/**
 * Settle: each sticker in turn, the headline last, slides towards a better spot in shrinking steps (8, 4, 2, 1 px)
 * while it touches nothing, so the gaps the grid left close up and the group draws together.
 */
function settle(plan: readonly Planned[], placed: StickerPlacement[], region: Box, o: CollageOptions): StickerPlacement[] {
  const focus = o.focus ?? { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  const out = placed.map((p) => ({ ...p }));
  const obstacles = (o.obstacles ?? []).filter((ob) => ob.points.length >= 3).map((ob) => ({ shape: shapeOf(ob.points), gap: o.clearance }));
  const shapes = out.map((p) => shapeOf(placedPolygon(p, plan[p.index].hull)));
  for (let round = 0; round < 2; round++) {
    for (let k = out.length - 1; k >= 0; k--) {
      const p = out[k];
      const others = out.filter((_, j) => j !== k);
      const weight = others.reduce((s, q) => s + q.width * q.height, 0);
      const weightX = others.reduce((s, q) => s + q.x * q.width * q.height, 0);
      const score = scorer(focus, region, weightX, weight, p.width * p.height, `${o.seed}|${p.index}`);
      const m = new Mover(plan[p.index].hull, p.width, p.height, p.rotation);
      const tests: Test[] = [...obstacles, ...shapes.filter((_, j) => j !== k).map((shape) => ({ shape, gap: o.gap }))].map(({ shape, gap }) => ({ shape, gap, ...m.against(shape) }));
      const x0 = region.x + o.clearance - m.box.minX;
      const x1 = region.x + region.width - o.clearance - m.box.maxX;
      const y0 = region.y + o.clearance - m.box.minY;
      const y1 = region.y + region.height - o.clearance - m.box.maxY;
      const ok = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && tests.every((t) => clear(t, x, y, m.box));
      let { x, y } = p;
      let s = score(x, y);
      for (const step of [8, 4, 2, 1]) {
        for (let moved = true, tries = 0; moved && tries < 24; tries++) {
          moved = false;
          for (const [dx, dy] of DIRECTIONS) {
            const nx = x + dx * step;
            const ny = y + dy * step;
            const ns = score(nx, ny);
            if (ns < s && ok(nx, ny)) {
              x = nx;
              y = ny;
              s = ns;
              moved = true;
            }
          }
        }
      }
      if (x !== p.x || y !== p.y) {
        out[k] = { ...p, x, y };
        shapes[k] = shapeOf(placedPolygon(out[k], plan[p.index].hull));
      }
    }
  }
  return out;
}

const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

/** The best spot for one sticker: a coarse grid over the region, then a fine one round the few best. */
function bestSpot(m: Mover, fixed: readonly { shape: Shape; gap: number }[], region: Box, clearance: number, score: (x: number, y: number) => number): { x: number; y: number } | null {
  const x0 = region.x + clearance - m.box.minX;
  const x1 = region.x + region.width - clearance - m.box.maxX;
  const y0 = region.y + clearance - m.box.minY;
  const y1 = region.y + region.height - clearance - m.box.maxY;
  if (x0 > x1 || y0 > y1) return null;
  const tests: Test[] = fixed.map(({ shape, gap }) => ({ shape, gap, ...m.against(shape) }));
  const ok = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && tests.every((t) => clear(t, x, y, m.box));
  const step = Math.max(4, Math.max(region.width, region.height) / 28);
  const found: { x: number; y: number; s: number }[] = [];
  const nx = Math.floor((x1 - x0) / step);
  const ny = Math.floor((y1 - y0) / step);
  for (let gy = 0; gy <= ny; gy++) {
    for (let gx = 0; gx <= nx; gx++) {
      // spread the grid evenly over the span, both ends included
      const x = nx ? x0 + ((x1 - x0) * gx) / nx : (x0 + x1) / 2;
      const y = ny ? y0 + ((y1 - y0) * gy) / ny : (y0 + y1) / 2;
      if (ok(x, y)) found.push({ x, y, s: score(x, y) });
    }
  }
  found.sort((a, b) => a.s - b.s);
  let best = found[0] ?? null;
  // The fine grid round the four best coarse spots (and round the coarse cells' corners, where a tight gap may be).
  const seeds = found.length ? found.slice(0, 4) : [];
  if (!seeds.length) {
    // Nothing on the coarse grid: the fine grid everywhere, a last look for a tight spot.
    const fine = step / 3;
    for (let y = y0; y <= y1; y += fine) for (let x = x0; x <= x1; x += fine) if (ok(x, y)) {
      const s = score(x, y);
      if (!best || s < best.s) best = { x, y, s };
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  const fine = step / 5;
  for (const c of seeds) {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const x = c.x + dx * fine;
        const y = c.y + dy * fine;
        if (!ok(x, y)) continue;
        const s = score(x, y);
        if (s < best!.s) best = { x, y, s };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

// ---------------------------------------------------------------------------------------------------- the numbers
/** FNV-1a, 32 bits: a seed string to a number. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded random source in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded value in [0, 1) for a spot, the same whatever order the spots are looked at in. */
function noise(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Sine and cosine of a small angle in degrees by their series (only + and ×, which every engine rounds alike; tilts
// stay under 30°, where the error is below 1e-12). Math.sin may differ in its last bit between engines.
const RAD = Math.PI / 180;
export function sinDeg(deg: number): number {
  const x = deg * RAD;
  const x2 = x * x;
  return x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - x2 / 156))))));
}
export function cosDeg(deg: number): number {
  const x = deg * RAD;
  const x2 = x * x;
  return 1 - (x2 / 2) * (1 - (x2 / 12) * (1 - (x2 / 30) * (1 - (x2 / 56) * (1 - (x2 / 90) * (1 - x2 / 132)))));
}
/** asin in degrees by bisection on sinDeg, for 0–1 (to 0.01°). */
function asinDeg(v: number): number {
  if (v >= 1) return 90;
  let a = 0;
  let b = 90;
  for (let i = 0; i < 14; i++) {
    const mid = (a + b) / 2;
    if (sinDeg(mid) < v) a = mid;
    else b = mid;
  }
  return a;
}
