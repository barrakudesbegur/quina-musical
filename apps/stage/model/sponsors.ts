// The sponsor strip's rules (ANIMATIONS.md `sponsor-pan`, `sponsor-pages`): before the Game and in the Break, the plan's
// sponsors (a real night has about 55) pan by in one row or more, or, under reduced motion, show one page at a time and
// turn the page every few seconds, so every sponsor is mentioned (docs/event.md). Pure: the clock and sizes come in.

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

/**
 * The list split into `rows` rows in order, as evenly as it goes (the first rows one longer); no empty row, so a short
 * list fills fewer rows (S4, 27 Nov evening: the row count is a knob, `STAGE.sponsorStrip.rows`).
 */
export function stripRows<T>(list: readonly T[], rows: number): T[][] {
  const count = Math.max(1, Math.min(Math.floor(rows) || 1, list.length));
  const out: T[][] = [];
  let at = 0;
  for (let r = 0; r < count; r++) {
    const size = Math.ceil((list.length - at) / (count - r));
    out.push(list.slice(at, at + size));
    at += size;
  }
  return out.filter((row) => row.length > 0);
}

/**
 * How many times one row's list repeats in one loop of the pan, so a loop is never narrower than the strip and no gap
 * ever shows at its end (S4): 1 for a long list; a short one (`listPx` under the strip's `viewPx`) more.
 */
export function loopRepeats(listPx: number, viewPx: number): number {
  if (!(listPx > 0) || !(viewPx > 0)) return 1;
  return Math.max(1, Math.ceil(viewPx / listPx));
}
