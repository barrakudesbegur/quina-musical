// Fitting the reference box (1440×1080) to the screen: scaled to fit and centred (pillarboxed at 16:10 and 16:9),
// with the drum's band stretched to the screen's full width, and the bleed the screen-wide layers reach into. Pure.

export interface BoxFit {
  scale: number;
  /** Top-left corner of the scaled box on the screen (px). */
  x: number;
  y: number;
}

export function fitBox(viewWidth: number, viewHeight: number, boxWidth: number, boxHeight: number): BoxFit {
  if (viewWidth <= 0 || viewHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) return { scale: 0, x: 0, y: 0 };
  const scale = Math.min(viewWidth / boxWidth, viewHeight / boxHeight);
  return { scale, x: (viewWidth - boxWidth * scale) / 2, y: (viewHeight - boxHeight * scale) / 2 };
}

/**
 * How far the screen reaches past the box on each side, in box px: 0 at 4:3, 144 at 16:10, 240 at 16:9 (`x`), and
 * `y` on a screen taller than 4:3. The layers that span the screen (the garland, the paper, the flash, the finale's
 * floor and light) reach this far out of the box; everything else stays inside it.
 */
export function boxBleed(fit: BoxFit): { x: number; y: number } {
  if (fit.scale <= 0) return { x: 0, y: 0 };
  const box = (v: number) => Math.round((v / fit.scale) * 100) / 100;
  return { x: box(fit.x), y: box(fit.y) };
}

/**
 * A paper rain's piece count on a canvas `width` px wide, for `count` pieces per box width: a wider screen's rain
 * (16:10, 16:9: the canvas reaches into the bleed) is as dense as the 4:3 one, never sparser.
 */
export function paperCount(count: number, width: number, boxWidth: number): number {
  if (boxWidth <= 0 || !(width > boxWidth)) return count;
  return Math.round((count * width) / boxWidth);
}

/** The drum's band on the screen (px): the whole width, at the box's band height. */
export function bandOnScreen(fit: BoxFit, band: { top: number; height: number }): { top: number; height: number } {
  return { top: fit.y + band.top * fit.scale, height: band.height * fit.scale };
}

/** How long the credits take to roll `contentPx` past a `viewPx` window at `pxPerSec`; 0 when they fit. */
export function creditsRollMs(contentPx: number, viewPx: number, pxPerSec: number): number {
  if (contentPx <= viewPx || pxPerSec <= 0) return 0;
  return Math.round(((contentPx + viewPx) / pxPerSec) * 1000);
}
