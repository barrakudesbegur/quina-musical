// Small deterministic and secure random helpers shared by the planner and the drum solver.

/**
 * Mulberry32: a fast deterministic generator, so a seed always replays the same transition or spin.
 * @returns uniform in [0, 1)
 */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A well-spread 32-bit seed for draw number `n` from `seed` (the SplitMix32 step and finalizer), so the draws
 * 0, 1, 2… of one seed are unrelated streams.
 * @returns an unsigned 32-bit seed
 */
export function mixSeed(seed: number, n: number): number {
  let z = ((seed >>> 0) + Math.imul((n + 1) >>> 0, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/** @returns uniform in [0, 1), from the platform's secure generator */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

/** @returns an unsigned 32-bit seed */
export function randomSeed(random: () => number = secureRandom): number {
  return Math.floor(random() * 2 ** 32) >>> 0;
}

/** Fisher–Yates shuffle into a new array; `items` is left untouched. */
export function secureShuffle<T>(items: Iterable<T>, random: () => number = secureRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A key of `weights`, drawn in proportion to its weight. Keys with a weight of 0 or less never win.
 * @returns null when no weight is positive
 */
export function weightedPick<K extends string>(weights: Readonly<Partial<Record<K, number>>>, random: () => number): K | null {
  // Object.entries types keys as string; they are the keys of `weights`.
  const entries = (Object.entries(weights) as [K, number | undefined][]).filter((e): e is [K, number] => (e[1] ?? 0) > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (!entries.length || total <= 0) return null;
  let r = random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Modulo that is never negative for a positive divisor. */
export const mod = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;
