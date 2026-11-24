// The cards in play, entered once for the whole Game as ranges ("1-180, 200-215, 400-460"): read the same way by the
// engine, Admin's preview and the console. Pure.

/** The most card ids a set of ranges may name (a typo like "1-1000000" is refused, not expanded). */
export const MAX_RANGE_IDS = 100000;

/**
 * "1-180, 200–215, 400 - 460" → [1, …, 180, 200, …, 215, 400, …, 460]. Separators: commas, semicolons and
 * whitespace. Dashes: - ‐ ‑ ‒ – — −. A reversed range (20-10) reads as 10-20.
 * @returns Sorted unique card ids.
 * @throws On a token that isn't a number or a range, or a range of more than MAX_RANGE_IDS ids.
 */
export function parseCardRanges(text: string | null | undefined): number[] {
  if (text == null) return [];
  const normalised = String(text)
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, '-');
  const ids = new Set<number>();
  for (const token of normalised.split(/[\s,;]+/)) {
    if (!token) continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) throw new Error(`Unrecognised card range: "${token}"`);
    let a = Number(match[1]);
    let b = match[2] == null ? a : Number(match[2]);
    if (a > b) [a, b] = [b, a];
    if (b - a + 1 + ids.size > MAX_RANGE_IDS) throw new Error(`Card range too large: "${token}"`);
    for (let id = a; id <= b; id++) ids.add(id);
  }
  return [...ids].sort((x, y) => x - y);
}

