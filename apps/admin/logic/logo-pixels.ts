// The logo clean-up's pixel work, as pure functions over ImageData-like RGBA arrays. Sponsors send JPEGs with
// a white background or big padding; Admin turns them into a trimmed logo on transparency:
//   1. detectBackground: the background colour, from the four corners;
//   2. removeBackground: near-background pixels become transparent, with a tolerance and a soft edge.
//      'edges' (the default) only clears background connected to the border, so white letters inside a
//      logo survive; 'all' clears that colour everywhere (for holes such as the inside of an "O");
//   3. contentBounds + crop: trim to the content's bounding box;
//   4. fitInside: the final size, inside 512×256 keeping the aspect (the canvas does the resampling).
// No DOM, no canvas: the browser glue is data/logo-canvas.ts. Tested in tests/ui/manage/logo-pixels.test.ts.
import { LOGO_CONFIG } from '../config.ts';

/** RGBA pixels, row by row, 4 bytes each: the shape of the DOM's ImageData. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type Background =
  /** A solid colour, agreed by `corners` of the four corners. */
  | { kind: 'color'; color: Rgb; corners: number }
  /** The corners are already transparent (a PNG): nothing to remove, only trim. */
  | { kind: 'transparent'; corners: number }
  /** The corners disagree: no colour is removed. */
  | { kind: 'unclear' };

export type RemoveMode = 'edges' | 'all';

export interface RemoveOptions {
  tolerance: number;
  softness: number;
  mode: RemoveMode;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function makePixels(width: number, height: number, data?: Uint8ClampedArray): Pixels {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  if (data && data.length !== w * h * 4) throw new RangeError(`pixels: expected ${w * h * 4} bytes, got ${data.length}`);
  return { width: w, height: h, data: data ?? new Uint8ClampedArray(w * h * 4) };
}

/** Distance between two colours on a 0–255 scale (Euclidean in RGB, divided by √3). */
export function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(3);
}

/** "#ffffff" for showing the detected colour. */
export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** The average colour and alpha of a square patch. */
function patchAverage(p: Pixels, x0: number, y0: number, size: number): { color: Rgb; alpha: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let n = 0;
  for (let y = y0; y < Math.min(p.height, y0 + size); y++) {
    for (let x = x0; x < Math.min(p.width, x0 + size); x++) {
      const i = (y * p.width + x) * 4;
      r += p.data[i];
      g += p.data[i + 1];
      b += p.data[i + 2];
      a += p.data[i + 3];
      n++;
    }
  }
  return n ? { color: { r: r / n, g: g / n, b: b / n }, alpha: a / n } : { color: { r: 0, g: 0, b: 0 }, alpha: 0 };
}

/** The background, from the four corners: the colour most of them share, or transparency. */
export function detectBackground(
  p: Pixels,
  { patch = LOGO_CONFIG.cornerPatch, agreeDistance = LOGO_CONFIG.cornerAgreeDistance }: { patch?: number; agreeDistance?: number } = {},
): Background {
  if (!p.width || !p.height) return { kind: 'unclear' };
  const size = Math.max(1, Math.min(patch, p.width, p.height));
  const corners = [
    patchAverage(p, 0, 0, size),
    patchAverage(p, p.width - size, 0, size),
    patchAverage(p, 0, p.height - size, size),
    patchAverage(p, p.width - size, p.height - size, size),
  ];
  const transparent = corners.filter((c) => c.alpha < 128).length;
  const opaque = corners.filter((c) => c.alpha >= 128).map((c) => c.color);
  // The opaque corner with the most others close to it, and its group.
  let best: Rgb[] = [];
  for (const c of opaque) {
    const group = opaque.filter((o) => colorDistance(c, o) <= agreeDistance);
    if (group.length > best.length) best = group;
  }
  if (transparent >= 2 && transparent >= best.length) return { kind: 'transparent', corners: transparent };
  if (best.length >= 2) {
    const avg = (k: keyof Rgb) => Math.round(best.reduce((s, c) => s + c[k], 0) / best.length);
    return { kind: 'color', color: { r: avg('r'), g: avg('g'), b: avg('b') }, corners: best.length };
  }
  return { kind: 'unclear' };
}

/** How much of a pixel stays at a distance `d` from the background: 0 (gone) to 1 (kept). */
export function keepFactor(d: number, tolerance: number, softness: number): number {
  if (d <= tolerance) return 0;
  if (softness <= 0 || d >= tolerance + softness) return 1;
  return (d - tolerance) / softness;
}

/**
 * Make near-background pixels transparent. A pixel on the soft edge keeps part of its alpha, and its colour
 * is un-mixed from the background, so a logo cut from white shows no white halo on the dark show screen.
 */
export function removeBackground(p: Pixels, bg: Rgb, { tolerance, softness, mode }: RemoveOptions): Pixels {
  const out = makePixels(p.width, p.height, new Uint8ClampedArray(p.data));
  const n = p.width * p.height;
  const factor = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const i = k * 4;
    factor[k] = keepFactor(colorDistance({ r: p.data[i], g: p.data[i + 1], b: p.data[i + 2] }, bg), tolerance, softness);
  }
  // Which pixels may change: all of them, or only those connected to the border through near-background ones.
  let region: Uint8Array | null = null;
  if (mode === 'edges') {
    const reached = new Uint8Array(n);
    region = reached;
    const stack: number[] = [];
    const visit = (k: number) => {
      if (reached[k] || factor[k] >= 1) return;
      reached[k] = 1;
      stack.push(k);
    };
    for (let x = 0; x < p.width; x++) {
      visit(x);
      visit((p.height - 1) * p.width + x);
    }
    for (let y = 0; y < p.height; y++) {
      visit(y * p.width);
      visit(y * p.width + p.width - 1);
    }
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % p.width;
      const y = (k - x) / p.width;
      // Spread only through pixels inside the tolerance; soft-edge pixels are reached but stop the spread.
      if (factor[k] > 0) continue;
      if (x > 0) visit(k - 1);
      if (x < p.width - 1) visit(k + 1);
      if (y > 0) visit(k - p.width);
      if (y < p.height - 1) visit(k + p.width);
    }
  }
  for (let k = 0; k < n; k++) {
    const f = factor[k];
    if (f >= 1 || (region && !region[k])) continue;
    const i = k * 4;
    if (f > 0) {
      // Observed = f·logo + (1 − f)·background, so logo = (observed − (1 − f)·background) / f.
      out.data[i] = (p.data[i] - (1 - f) * bg.r) / f;
      out.data[i + 1] = (p.data[i + 1] - (1 - f) * bg.g) / f;
      out.data[i + 2] = (p.data[i + 2] - (1 - f) * bg.b) / f;
    }
    out.data[i + 3] = p.data[i + 3] * f;
  }
  return out;
}

/** The smallest box holding every pixel with at least `alphaFloor` alpha, or null when there is none. */
export function contentBounds(p: Pixels, alphaFloor: number = LOGO_CONFIG.alphaFloor): Box | null {
  let minX = p.width;
  let minY = p.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (p.data[(y * p.width + x) * 4 + 3] < alphaFloor) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** A copy of the box's pixels (the box is clamped to the image). */
export function crop(p: Pixels, box: Box): Pixels {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const w = Math.max(0, Math.min(p.width - x0, Math.floor(box.width)));
  const h = Math.max(0, Math.min(p.height - y0, Math.floor(box.height)));
  const out = makePixels(w, h);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * p.width + x0) * 4;
    out.data.set(p.data.subarray(from, from + w * 4), y * w * 4);
  }
  return out;
}

/** The size that fits `width`×`height` inside `maxWidth`×`maxHeight` keeping the aspect (never 0). */
export function fitInside(
  width: number,
  height: number,
  maxWidth: number = LOGO_CONFIG.maxWidth,
  maxHeight: number = LOGO_CONFIG.maxHeight,
  { upscale = false }: { upscale?: boolean } = {},
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  let scale = Math.min(maxWidth / width, maxHeight / height);
  if (!upscale) scale = Math.min(1, scale);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface CleanOptions extends RemoveOptions {
  /** False to keep every pixel (only trim). */
  removeBackground: boolean;
  alphaFloor?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface CleanResult {
  background: Background;
  /** The trimmed pixels at their original scale (the canvas resizes them to `size`). */
  pixels: Pixels;
  /** Where the content was in the source. */
  bounds: Box | null;
  size: { width: number; height: number };
  /** Nothing left after removing the background. */
  empty: boolean;
}

/** Steps 1–4 in order. Never throws. */
export function cleanLogo(source: Pixels, options: CleanOptions): CleanResult {
  const background = detectBackground(source);
  const cleared = options.removeBackground && background.kind === 'color' ? removeBackground(source, background.color, options) : source;
  const bounds = contentBounds(cleared, options.alphaFloor);
  if (!bounds) return { background, pixels: makePixels(0, 0), bounds: null, size: { width: 0, height: 0 }, empty: true };
  const pixels = crop(cleared, bounds);
  return { background, pixels, bounds, size: fitInside(pixels.width, pixels.height, options.maxWidth, options.maxHeight), empty: false };
}
