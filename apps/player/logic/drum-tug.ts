// The drum's tug (ANIMATIONS.md `drum-tug`, D220): while the drum is still, a sideways drag turns it a little, stiffly,
// and it springs back. It must reveal nothing new: the phone's drum shows only songs still to come, so the tug may
// only wobble the covers already in view. Pure.

export interface TugOptions {
  /** The design's most: a stiff wobble of a few degrees. */
  maxDeg: number;
  /** The rubber band: px of drag for about two thirds of the most. */
  stiffnessPx: number;
  /** The tiles on the ring. */
  tiles: number;
  /** The perspective as a multiple of the ring's radius (player.css: `perspective: calc(var(--drum-r) * 2.4)`). */
  perspectiveRatio: number;
  /** Px of movement that decide the drag's axis. */
  slopPx: number;
}

export const TUG: TugOptions = { maxDeg: 4, stiffnessPx: 90, tiles: 10, perspectiveRatio: 2.4, slopPx: 8 };

/**
 * The largest turn that can't show a hidden face: a tile's face shows once its angle from the front is under
 * acos(r / (P + r)) (the viewer at P in front of the front tile); the first hidden tile sits at the first tile step
 * past that limit. A turn must stay below the gap between the two, with a degree to spare.
 */
export function hiddenFaceLimitDeg(tiles: number, perspectiveRatio: number): number {
  const step = 360 / tiles;
  const visible = (Math.acos(1 / (perspectiveRatio + 1)) * 180) / Math.PI;
  const firstHidden = Math.ceil((visible + 1e-9) / step) * step;
  return Math.max(0, firstHidden - visible - 1);
}

/** The turn for a horizontal drag of `dx` px: rubber-banded, never past the design's most or the hidden-face limit. */
export function tugAngle(dx: number, o: TugOptions = TUG): number {
  const most = Math.min(o.maxDeg, hiddenFaceLimitDeg(o.tiles, o.perspectiveRatio));
  const pull = most * (1 - Math.exp(-Math.abs(dx) / o.stiffnessPx));
  return Math.sign(dx) * Math.min(pull, most);
}

/** Which way a drag goes once it has moved past the slop: 'x' tugs the drum, 'y' leaves it to the page's scroll. */
export function tugAxis(dx: number, dy: number, o: Pick<TugOptions, 'slopPx'> = TUG): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < o.slopPx) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}
