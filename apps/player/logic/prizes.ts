// The Premis drawer (D244, answering U30; board Mobil-Premis-D244): one round at a time behind P1's round selector
// (‹ Quina 3 ARA ›), each page P2's content: a bundle's headline prizes on paper, its sponsors' prizes in rows with
// their logos, and the rest of the hamper on one line. A round still secret shows «Premis sorpresa» and the night's
// sponsors instead (the page is the component's; components-v2.md § 11.11). Pure, tested in node.
import type { PrizeItem, PrizeLine, PrizeRound } from './view.ts';

/**
 * The round the drawer opens on: the one Horari asked for, else the round in focus (the intro's, the Interval's next,
 * the current one), else the first planned round; null without any round. A number the plan doesn't list falls back
 * the same way.
 */
export function prizesStartRound(rounds: readonly PrizeRound[], asked: number | null | undefined, focus: number | null): number | null {
  const has = (n: number | null | undefined): n is number => n !== null && n !== undefined && rounds.some((r) => r.number === n);
  if (has(asked)) return asked;
  if (has(focus)) return focus;
  return rounds[0]?.number ?? null;
}

/** The round one step from `current` (−1: ‹, +1: ›), or null at either end. */
export function stepRound(rounds: readonly PrizeRound[], current: number, by: -1 | 1): number | null {
  const i = rounds.findIndex((r) => r.number === current);
  if (i < 0) return null;
  return rounds[i + by]?.number ?? null;
}

/** A bundle as the drawer's page shows it (P2). */
export interface BundleView {
  /** How many prizes the bundle holds, headline included («17 premis»). */
  count: number;
  /** The headline prizes, each on paper with its sponsor's logo (or the gift, when it has none). */
  headline: PrizeItem[];
  /** The other prizes that name a sponsor or a detail: a row each, with the logo. */
  rows: PrizeItem[];
  /** The plain ones (no sponsor, no detail: a hamper's staples), on one line, in their order, as written. */
  plain: string[];
}

export function bundleView(line: PrizeLine): BundleView {
  const rows = line.others.filter((p) => p.sponsor || p.detail);
  const plain = line.others.filter((p) => !p.sponsor && !p.detail).map((p) => p.title);
  return { count: line.headline.length + line.others.length, headline: [...line.headline], rows, plain };
}
