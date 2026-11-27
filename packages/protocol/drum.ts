// The drum's tile order and Spin seeds, shared by the projector and the phones (D237: "the phone's drum matches the
// projector's"). A round's tiles are its Queue's songs, which are its pool's (public), in the order a public per-round
// `drumSeed` gives them; each Spin's trajectory comes from the engine's solver (apps/show/engine/src/wheel/solver.ts,
// pure) with the public `spinSeed`. Neither seed tells anything about the Queue: drumSeed is drawn on its own.

/** A seeded random source (mulberry32, as the engine's rng.ts): the same seed gives the same numbers everywhere. */
export function drumRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The drum's tiles for a round: its songs sorted by id, then shuffled (Fisher–Yates) from `drumSeed`. The drum shows
 * the ones still to play (and the last landing) in this order, so a phone that knows the round's songs and the seed
 * lays out the same drum.
 */
export function drumOrder(songIds: readonly number[], drumSeed: number): number[] {
  const out = [...songIds].sort((a, b) => a - b);
  const random = drumRandom(drumSeed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
