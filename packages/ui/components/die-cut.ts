// G4 · a sponsor's logo as a die-cut sticker (D285, D287: "i really like the sponsor stickers"), the way the ninos are
// cut: a white backing that follows the logo's outline, rounded, with the holes inside the outline filled (a printed
// sticker has no holes), and no ink keyline (the ninos have none round their white, and a keyline would redraw the
// sponsor's brand). The logo's own pixels are never changed: no recolouring, no tint, no filter (the Orchestrator's
// rule, 28 Nov: the real logos stay recognisable). Only the white backing is made here; the tilt and the hard drop
// shadow are the screens' CSS, as for the ninos. The sticker collage (sticker-collage.ts) packs the result by `hull`.
//
// How (the same steps as the board's first examples, temp/design-canvas/look/gen/logo_stickers.py):
//   1. the logo's silhouette: alpha above 40 %;
//   2. holes filled: every transparent pixel the border can't reach becomes part of the silhouette;
//   3. a closing on the exact distance field: grow by rim + reach, fill the holes that makes, shrink by reach; it
//      bridges the gaps between letters and rounds the inner corners, as a sticker printer's smooth cut does;
//   4. the cut's edge antialiased from the distance field; the logo composited over the white, untouched.
// Pure: RGBA pixels in (ImageData's shape: Admin's logo-pixels.ts, a canvas, a decoded PNG), RGBA pixels out. No DOM.

/** RGBA pixels row by row, 4 bytes each, straight (not premultiplied) alpha: the shape of the DOM's ImageData. */
export interface RgbaPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface Point {
  x: number;
  y: number;
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DieCutOptions {
  /** The white rim beyond the logo, as a share of the logo's longer side (the ninos' is about 3.5 % of their height). */
  rim?: number;
  /** How far the closing reaches, as a share of the longer side: gaps between letters up to about twice this close. */
  reach?: number;
  /** The alpha (0–255) above which a logo pixel is part of its silhouette. */
  alphaFloor?: number;
  /** The most points the hull keeps (each extra point costs the collage's packing a little). */
  hullPoints?: number;
}

export interface DieCut {
  /** The sticker: the white die-cut with the logo on it, cropped to the cut with 2 px to spare. */
  pixels: RgbaPixels;
  /** Where the logo's own pixels sit in the sticker. */
  logo: PixelBox;
  /** The cut's convex hull in the sticker's box, normalised to 0–1 (x right, y down), clockwise on screen. */
  hull: Point[];
}

export const DIE_CUT = Object.freeze({
  /** 5 % of the longer side: thick enough to read as a sticker from the back of the room, thin enough to keep the logo
   * big inside its slot (the board's examples, 28 Nov). */
  rim: 0.05,
  /** 6 %: bridges a wordmark's letter gaps and rounds a badge's notches without swallowing a logo's real shape. */
  reach: 0.06,
  alphaFloor: 102,
  hullPoints: 16,
});

/** The antialiased ramp across the cut line, in px. */
const RAMP = 1.5;

export function dieCut(logo: RgbaPixels, options: DieCutOptions = {}): DieCut {
  const rimShare = options.rim ?? DIE_CUT.rim;
  const reachShare = options.reach ?? DIE_CUT.reach;
  const floor = options.alphaFloor ?? DIE_CUT.alphaFloor;
  const { width: w, height: h } = logo;
  const longer = Math.max(w, h, 1);
  const rim = Math.max(1, Math.round(longer * rimShare));
  const reach = Math.max(0, Math.round(longer * reachShare));
  const pad = rim + reach + 2;
  const W = w + 2 * pad;
  const H = h + 2 * pad;
  const n = W * H;

  // 1–2. the silhouette, its holes filled
  const shape = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (logo.data[(y * w + x) * 4 + 3] > floor) shape[(y + pad) * W + x + pad] = 1;
    }
  }
  fillHoles(shape, W, H);

  // 3. the closing: grow by rim + reach (distance from the silhouette), fill, then shrink by reach
  const outside = squaredDistance(shape, W, H, 1);
  const grow = (rim + reach) * (rim + reach);
  const grown = new Uint8Array(n);
  for (let k = 0; k < n; k++) grown[k] = outside[k] <= grow ? 1 : 0;
  fillHoles(grown, W, H);
  // A sticker is one piece: parts of a logo too far apart for the closing (a logo sheet with two versions, a wordmark
  // and its drawing side by side) share one cut, the convex hull round them all.
  if (islands(grown, W, H) > 1) fillConvex(grown, W, H);
  const inside = squaredDistance(grown, W, H, 0);

  // 4. the white's alpha, antialiased across the cut, solid under the logo; then the logo over it, untouched
  const out = new Uint8ClampedArray(n * 4);
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      let white = shape[k] ? 1 : grown[k] ? clamp01((Math.sqrt(inside[k]) - reach) / RAMP + 0.5) : 0;
      const lx = x - pad;
      const ly = y - pad;
      let r = 255;
      let g = 255;
      let b = 255;
      let a = white;
      if (lx >= 0 && ly >= 0 && lx < w && ly < h) {
        const i = (ly * w + lx) * 4;
        const la = logo.data[i + 3] / 255;
        if (la > 0) {
          // source-over in straight alpha: the logo's colour wherever it is opaque, blended with the white at its edge
          a = la + white * (1 - la);
          r = (logo.data[i] * la + 255 * white * (1 - la)) / a;
          g = (logo.data[i + 1] * la + 255 * white * (1 - la)) / a;
          b = (logo.data[i + 2] * la + 255 * white * (1 - la)) / a;
          white = a;
        }
      }
      if (a <= 0) continue;
      const o = k * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a * 255;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    const empty = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    return { pixels: empty, logo: { x: 0, y: 0, width: 0, height: 0 }, hull: [] };
  }
  const x0 = Math.max(0, minX - 2);
  const y0 = Math.max(0, minY - 2);
  const cw = Math.min(W, maxX + 3) - x0;
  const ch = Math.min(H, maxY + 3) - y0;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) data.set(out.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + cw) * 4), y * cw * 4);
  const pixels = { width: cw, height: ch, data };
  return {
    pixels,
    logo: { x: pad - x0, y: pad - y0, width: w, height: h },
    hull: alphaHull(pixels, { alphaFloor: 64, maxPoints: options.hullPoints ?? DIE_CUT.hullPoints }),
  };
}

/**
 * The convex hull of an image's opaque pixels, normalised to its box (0–1), clockwise on screen, at most `maxPoints`
 * points. Conservative: every pixel above `alphaFloor` lies inside it (the corners of a coarse grid of cells, then
 * edges merged outward). For a die-cut sticker (the collage's packing) or a nino (an obstacle the collage keeps off).
 */
export function alphaHull(p: RgbaPixels, { alphaFloor = 128, maxPoints = 16, cells = 64 }: { alphaFloor?: number; maxPoints?: number; cells?: number } = {}): Point[] {
  const { width: w, height: h } = p;
  if (!w || !h) return [];
  const size = Math.max(1, Math.ceil(Math.max(w, h) / cells));
  const rows = Math.ceil(h / size);
  const points: Point[] = [];
  for (let r = 0; r < rows; r++) {
    let left = -1;
    let right = -1;
    for (let y = r * size; y < Math.min(h, (r + 1) * size); y++) {
      for (let x = 0; x < w; x++) {
        if (p.data[(y * w + x) * 4 + 3] > alphaFloor) {
          if (left < 0 || x < left) left = x;
          break;
        }
      }
      for (let x = w - 1; x >= 0; x--) {
        if (p.data[(y * w + x) * 4 + 3] > alphaFloor) {
          if (x > right) right = x;
          break;
        }
      }
    }
    if (left < 0) continue;
    const top = r * size;
    const bottom = Math.min(h, (r + 1) * size);
    points.push({ x: left, y: top }, { x: left, y: bottom }, { x: right + 1, y: top }, { x: right + 1, y: bottom });
  }
  const hull = simplifyOutward(convexHull(points), maxPoints);
  return hull.map((q) => ({ x: q.x / w, y: q.y / h }));
}

/** Andrew's monotone chain; clockwise on screen (y down), no repeated or collinear points. */
export function convexHull(points: readonly Point[]): Point[] {
  const ps = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (ps.length < 3) return ps;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const q = ps[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  // counter-clockwise in math axes is clockwise on screen (y down)
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Fewer points without cutting anything off: repeatedly drop the edge whose removal adds the least area, extending
 * its two neighbours to where they meet. The polygon only grows and stays convex.
 */
function simplifyOutward(hull: Point[], maxPoints: number): Point[] {
  const ps = hull.slice();
  const limit = Math.max(3, maxPoints);
  while (ps.length > limit) {
    let best = -1;
    let bestArea = Infinity;
    let bestAt: Point | null = null;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[(i - 1 + ps.length) % ps.length];
      const b = ps[i];
      const c = ps[(i + 1) % ps.length];
      const d = ps[(i + 2) % ps.length];
      const at = meet(a, b, c, d);
      if (!at) continue;
      const area = Math.abs((c.x - b.x) * (at.y - b.y) - (c.y - b.y) * (at.x - b.x)) / 2;
      if (area < bestArea) {
        bestArea = area;
        best = i;
        bestAt = at;
      }
    }
    if (best < 0 || !bestAt) break;
    ps.splice(best, 1, bestAt);
    ps.splice((best + 1) % ps.length, 1);
  }
  return ps;
}

/** Where the line a→b, carried on past b, meets the line d→c carried on past c; null if they don't meet that way. */
function meet(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: c.x - d.x, y: c.y - d.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((d.x - a.x) * s.y - (d.y - a.y) * s.x) / den;
  const u = ((d.x - a.x) * r.y - (d.y - a.y) * r.x) / den;
  if (t < 1 || u < 1) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

/** How many separate pieces (4-connected) of 1s the mask holds. */
function islands(mask: Uint8Array, W: number, H: number): number {
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  let count = 0;
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    count++;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % W;
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (j >= 0 && j < W * H && mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return count;
}

/** The mask becomes the convex hull of its 1s (each row filled between the hull's edges). */
function fillConvex(mask: Uint8Array, W: number, H: number): void {
  const points: Point[] = [];
  for (let y = 0; y < H; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      if (left < 0) left = x;
      right = x;
    }
    if (left >= 0) points.push({ x: left, y }, { x: right, y });
  }
  const hull = convexHull(points);
  for (let y = 0; y < H; y++) {
    let from = Infinity;
    let to = -Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
        const x = a.y === b.y ? [a.x, b.x] : [a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)];
        for (const v of x) {
          from = Math.min(from, v);
          to = Math.max(to, v);
        }
      }
    }
    for (let x = Math.max(0, Math.ceil(from)); x <= Math.min(W - 1, Math.floor(to)); x++) mask[y * W + x] = 1;
  }
}

/** Every 0 the border can't reach through other 0s (4-connected) becomes 1: the holes inside a shape. */
function fillHoles(mask: Uint8Array, W: number, H: number): void {
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  const visit = (k: number) => {
    if (seen[k] || mask[k]) return;
    seen[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < W; x++) {
    visit(x);
    visit((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    visit(y * W);
    visit(y * W + W - 1);
  }
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % W;
    if (x > 0) visit(k - 1);
    if (x < W - 1) visit(k + 1);
    if (k >= W) visit(k - W);
    if (k < W * (H - 1)) visit(k + W);
  }
  for (let k = 0; k < W * H; k++) if (!seen[k]) mask[k] = 1;
}

/**
 * Each pixel's squared Euclidean distance to the nearest pixel whose mask equals `target` (Felzenszwalb and
 * Huttenlocher's exact transform: one pass down the columns, one along the rows).
 */
function squaredDistance(mask: Uint8Array, W: number, H: number, target: 0 | 1): Float64Array {
  const INF = 1e20;
  const out = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) out[k] = mask[k] === target ? 0 : INF;
  const size = Math.max(W, H);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = out[y * W + x];
    line(f, H, d, v, z);
    for (let y = 0; y < H; y++) out[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) f[x] = out[row + x];
    line(f, W, d, v, z);
    for (let x = 0; x < W; x++) out[row + x] = d[x];
  }
  return out;
}

/** The 1-D squared distance transform of `f` (length n) into `d`: the lower envelope of parabolas. */
function line(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
