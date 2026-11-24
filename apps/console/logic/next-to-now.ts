// The `next-to-now` morph (packages/ui/ANIMATIONS.md): when the next song lands, the "Següent" panel's cover,
// title and artist fly up into "Ara sona". The rule for when it runs and the FLIP maths are here, pure and
// tested; apps/console/morph.ts does the DOM part.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The transform that puts an element laid out at `to` back where `from` was (FLIP's "invert"). */
export interface Invert {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

export function invert(from: Box, to: Box): Invert {
  return {
    dx: from.left - to.left,
    dy: from.top - to.top,
    sx: to.width > 0 ? from.width / to.width : 1,
    sy: to.height > 0 ? from.height / to.height : 1,
  };
}

/**
 * Morph only when the song that landed is the one the console was showing as next, and motion is allowed.
 * Back (an undone landing) and a next song changed before it lands swap at once, so they never get here.
 */
export function shouldMorph(landedSongId: number, shownNextSongId: number | null | undefined, reducedMotion: boolean): boolean {
  return !reducedMotion && shownNextSongId !== null && shownNextSongId !== undefined && landedSongId === shownNextSongId;
}
