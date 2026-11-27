// The sponsor strip's pages (ANIMATIONS.md `sponsor-pages`): before the Game and in the Interval, the plan's sponsors
// don't fit one row on the 4:3 projector (a real night has about 55), so the strip shows one row at a time and turns
// the page every few seconds, so every sponsor is mentioned (docs/event.md). Pure: the clock comes in.

export interface SponsorPage<T> {
  /** 0-based, cycling. */
  index: number;
  pages: number;
  /** This page's sponsors; the last page is filled from the first, so the row is always full. */
  items: T[];
}

export function sponsorPage<T>(list: readonly T[], perPage: number, nowMs: number, pageMs: number): SponsorPage<T> {
  const size = Math.max(1, perPage);
  if (list.length <= size) return { index: 0, pages: 1, items: [...list] };
  const pages = Math.ceil(list.length / size);
  const index = Math.floor(Math.max(0, nowMs) / pageMs) % pages;
  const start = index * size;
  const items = Array.from({ length: size }, (_, i) => list[(start + i) % list.length]);
  return { index, pages, items };
}

/**
 * `sponsor-pan` (27 Nov, the user's canvas comment #88): one list's length (px, the doubled track's half) at a slow
 * steady speed makes one loop; the loop starts at a random point (`random` in [0, 1)), so the first logos on screen
 * differ each time. Returns CSS times in seconds: the duration and a negative delay.
 */
export function panTiming(listPx: number, pxPerSec: number, random: number): { durationS: number; delayS: number } {
  const durationS = Math.max(1, listPx / Math.max(1, pxPerSec));
  const at = Math.min(Math.max(random, 0), 0.999_999);
  return { durationS, delayS: -at * durationS };
}
