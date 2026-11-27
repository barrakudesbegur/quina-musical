// The drum's geometry (the projector's: wheel/drum.ts and drum.css) and its tug (ANIMATIONS.md `drum-tug`, D220): while
// the drum is still, a sideways drag turns it a little, stiffly, and it springs back. It must reveal nothing new: the
// tug may only wobble the tiles already in view, never bring in one that sits outside the drum's box (or turned away)
// at rest. Pure.

export interface DrumGeometry {
  /** Tiles on the ring. */
  tiles: number;
  /** A tile's width (px). */
  tilePx: number;
  /** The gap between tiles, as a share of a tile (the projector's CARD_GAP_RATIO). */
  gap: number;
  /** The perspective, in tiles (the projector's `--card-size × 5`). */
  perspectiveTiles: number;
  /** The drum's box (px): what shows of the ring. */
  widthPx: number;
}

/** The drum's mask (player.css) is see-through at its two edges and reaches 10 % this far in (a share of the width):
 * a tile shows once some of it is past that. */
export const MASK_EDGE = 0.027;

/** The ring's radius (px): the projector's `max(card, card × (1 + gap) / (2 tan(π / n)))`. */
export function drumRadius({ tiles, tilePx, gap }: Pick<DrumGeometry, 'tiles' | 'tilePx' | 'gap'>): number {
  return Math.max(tilePx, (tilePx * (1 + gap)) / (2 * Math.tan(Math.PI / Math.max(3, tiles))));
}

/**
 * The tiles that show (their offset from the one under the window, at rest) when the ring is turned by `turn` tiles
 * from rest: those facing the viewer (cos a > R / (P + R)) with some of their projected width where the mask shows.
 */
export function visibleTiles(g: DrumGeometry, turn: number): number[] {
  const R = drumRadius(g);
  const P = g.perspectiveTiles * g.tilePx;
  const half = g.widthPx * (0.5 - MASK_EDGE);
  const step = (2 * Math.PI) / g.tiles;
  const out: number[] = [];
  for (let k = -Math.floor(g.tiles / 2) || 0; k < Math.ceil(g.tiles / 2); k++) {
    const a = (k - turn) * step;
    if (Math.cos(a) <= R / (P + R)) continue;
    const xs = [-1, 1].map((side) => {
      const x = R * Math.sin(a) + side * (g.tilePx / 2) * Math.cos(a);
      const z = R * Math.cos(a) - R - side * (g.tilePx / 2) * Math.sin(a);
      return (x * P) / (P - z);
    });
    if (Math.max(...xs) > -half && Math.min(...xs) < half) out.push(k);
  }
  return out;
}

/** The largest tug (tiles, either way) that brings no tile into view, less a 0.01-tile margin. */
export function tugLimit(g: DrumGeometry): number {
  const atRest = new Set(visibleTiles(g, 0));
  const revealsNothing = (turn: number) => visibleTiles(g, turn).every((k) => atRest.has(k));
  let limit = 0.5;
  for (const sign of [-1, 1]) {
    let lo = 0;
    let hi = 0.5;
    if (revealsNothing(sign * hi)) continue;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (revealsNothing(sign * mid)) lo = mid;
      else hi = mid;
    }
    limit = Math.min(limit, lo);
  }
  return Math.max(0, limit - 0.01);
}

export interface TugOptions {
  /** The design's most, as the front tile's travel (px): a stiff wobble. */
  maxPx: number;
  /** The rubber band: px of drag for about two thirds of the most. */
  stiffnessPx: number;
  /** Px of movement that decide the drag's axis. */
  slopPx: number;
}

export const TUG: TugOptions = { maxPx: 14, stiffnessPx: 90, slopPx: 8 };

/**
 * The turn (tiles) for a horizontal drag of `dx` px: rubber-banded, the front tile moving at most `maxPx`, and never
 * past `tugLimit` (nothing new comes into view). Dragging right turns the ring so the tiles follow the finger.
 */
export function tugTurn(dx: number, g: DrumGeometry, o: TugOptions = TUG): number {
  if (dx === 0) return 0;
  const R = drumRadius(g);
  const pull = o.maxPx * (1 - Math.exp(-Math.abs(dx) / o.stiffnessPx));
  const turn = Math.asin(Math.min(1, pull / R)) / ((2 * Math.PI) / g.tiles);
  return -Math.sign(dx) * Math.min(turn, tugLimit(g));
}

/** Which way a drag goes once it has moved past the slop: 'x' tugs the drum, 'y' leaves it to the page's scroll. */
export function tugAxis(dx: number, dy: number, o: Pick<TugOptions, 'slopPx'> = TUG): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < o.slopPx) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}
