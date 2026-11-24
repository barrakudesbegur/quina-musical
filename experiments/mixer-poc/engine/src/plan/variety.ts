// Rotation memory. A listener hears the whole night, not one transition, so every choice a transition draws
// remembers what the last transitions of the round did and turns those options down: the recipe and its family,
// how A leaves, the landing and its impact, the riser, R7's bridge, the gap, and the length of the build or of A's
// move. One rule for every dimension: an option used k transitions ago weighs `penalties[k − 1]` times as much,
// once for every use within the list (config.ts VARIETY). Nothing is ever forbidden here; the hard rules (never
// one family three times running, theatrical moves apart, cooldowns) stay in planner.ts chooseRecipe. Pure.
import { VARIETY } from '../config.ts';

/** One dimension of the last transitions, newest last; null where a transition had none (no A, no bridge). */
export type Recent<K> = readonly (K | null | undefined)[];

/**
 * What a transition leaves in the memory (planner.ts `summarize`). Only the recipe, its family and the exit are
 * required: entries written before the memory grew still count for those.
 */
export interface Remembered {
  recipe: string;
  family: string;
  /** An S2 recipe's exit move. */
  exit: string | null;
  /** How A left, as heard: the S2 exit, or what the S1 or S3 move did (echo, wash, gate, spiral, brake…); null without A. */
  move?: string | null;
  /** The landing layer (plan/landing.ts LandingStyle). */
  landing?: string | null;
  /** The impact's samples ('dry' for a dry landing). */
  impact?: string | null;
  /** The riser's flavour ('noise', or 'tone': noise with a climbing saw); null without one. */
  riser?: string | null;
  /** S2 only: the build's pattern (R7's bridge; the classic roll under D11, D19, D6 and R10) and its length in B's bars. */
  bridge?: string | null;
  bridgeBars?: number | null;
  /** S1 and S3: the length of A's move in its bars, when the recipe reports it. */
  bars?: number | null;
  /** The silence before B's pickup, in B's beats. */
  gapBeats?: number | null;
}

/** The round's last transitions, by dimension (newest last). Bridges count the S2 builds only, however far back. */
export interface Memory {
  recipes: Recent<string>;
  families: Recent<string>;
  moves: Recent<string>;
  landings: Recent<string>;
  impacts: Recent<string>;
  risers: Recent<string>;
  gaps: Recent<number>;
  bars: Recent<number>;
  bridges: Recent<string>;
  bridgeBars: Recent<number>;
}

export const NO_MEMORY: Memory = Object.freeze({
  recipes: [], families: [], moves: [], landings: [], impacts: [], risers: [], gaps: [], bars: [], bridges: [], bridgeBars: [],
});

/** The memory of the last VARIETY.memory transitions (and of the last VARIETY.memory S2 builds). */
export function memoryOf(history: readonly Remembered[], depth: number = VARIETY.memory): Memory {
  const last = history.slice(-depth);
  const builds = history.filter((h) => h.bridge != null).slice(-depth);
  return {
    recipes: last.map((h) => h.recipe),
    families: last.map((h) => h.family),
    moves: last.map((h) => h.move ?? h.exit),
    landings: last.map((h) => h.landing),
    impacts: last.map((h) => h.impact),
    risers: last.map((h) => h.riser),
    gaps: last.map((h) => h.gapBeats),
    bars: last.map((h) => h.bars),
    bridges: builds.map((h) => h.bridge),
    bridgeBars: builds.map((h) => h.bridgeBars),
  };
}

/** The factor `option` weighs by: the product of `penalties[k − 1]` for every k (1 = the newest) it was used. */
export function recency<K>(option: K, recent: Recent<K>, penalties: readonly number[]): number {
  let factor = 1;
  for (let k = 1; k <= penalties.length && k <= recent.length; k++) {
    if (recent[recent.length - k] === option) factor *= penalties[k - 1];
  }
  return factor;
}

/** `weights` with the recently used options turned down (never to zero: a lone option is still drawn). */
export function freshWeights<K extends string>(weights: Readonly<Partial<Record<K, number>>>, recent: Recent<string>, penalties: readonly number[]): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  // Object.entries types keys as string; they are the keys of `weights`.
  for (const [key, w] of Object.entries(weights) as [K, number | undefined][]) out[key] = (w ?? 0) * recency<string>(key, recent, penalties);
  return out;
}

/**
 * One of `options` (a value listed twice weighs double), the recently used ones turned down. Draws exactly one
 * number from `rng`, like events.ts `pick`.
 */
export function freshNumber(options: readonly number[], recent: Recent<number>, penalties: readonly number[], rng: () => number): number {
  if (!options.length) throw new RangeError('freshNumber: no options');
  const counts = new Map<number, number>();
  for (const x of options) counts.set(x, (counts.get(x) ?? 0) + 1);
  const weighted = [...counts].map(([x, n]) => [x, n * recency(x, recent, penalties)] as const);
  let r = rng() * weighted.reduce((sum, [, w]) => sum + w, 0);
  for (const [x, w] of weighted) {
    r -= w;
    if (r <= 0) return x;
  }
  return weighted[weighted.length - 1][0];
}
