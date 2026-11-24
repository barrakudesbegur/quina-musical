// Fitting the reference box (1440×1080) to the screen: scaled to fit and centred (letterboxed at 16:9),
// with the drum's band stretched to the screen's full width. Pure.

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

/** The drum's band on the screen (px): the whole width, at the box's band height. */
export function bandOnScreen(fit: BoxFit, band: { top: number; height: number }): { top: number; height: number } {
  return { top: fit.y + band.top * fit.scale, height: band.height * fit.scale };
}

/** How long the credits take to roll `contentPx` past a `viewPx` window at `pxPerSec`; 0 when they fit. */
export function creditsRollMs(contentPx: number, viewPx: number, pxPerSec: number): number {
  if (contentPx <= viewPx || pxPerSec <= 0) return 0;
  return Math.round(((contentPx + viewPx) / pxPerSec) * 1000);
}
