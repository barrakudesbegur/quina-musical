// The tie-free Shuffle (GLOSSARY: Shuffle, Tie). The rule is public: the round's Queue is drawn
// deterministically from a secret seed, and redrawn (draw 1, 2, …) until neither the first Line nor the first
// Bingo is a Tie among the cards in play valid for the round. A Desgraciat round (rule 'none') keeps its first draw:
// it can't tie, since a landing that would take every card left out counts for none of them (D180).
// Pure: the seed comes from the caller (the show draws it from its secure generator), so a seed and the
// Pool always give back the same Queue.
//
//   draw k of seed s = Fisher–Yates over the Pool in its order, driven by Mulberry32(mixSeed(s, k))
//
// With no cards in play there is nothing to check and draw 0 is kept. If every draw up to `maxAttempts` ties,
// the last one is kept with `tied: true`; the show never blocks on it.
import { firstWinAt, type Card, type FirstWin } from './cards.ts';
import { mixSeed, secureShuffle, seededRandom } from '../rng.ts';

export interface TieFreeOptions {
  /** The Pool's song ids, in their catalogue order (the order is part of the rule). */
  pool: readonly number[];
  /** The cards in play valid for the round. */
  cards: readonly Card[];
  /** An unsigned 32-bit secret seed. */
  seed: number;
  maxAttempts: number;
  /** What a Tie is: the first Line or Bingo shared (default); none in the Desgraciat round. */
  rule?: TieRule;
}

/** 'firstWins': no Tie on the first Line nor the first Bingo. 'none': nothing to check (the Desgraciat round). */
export type TieRule = 'firstWins' | 'none';

export interface TieFreeShuffle {
  queue: number[];
  seed: number;
  /** The draw kept: how many times it reshuffled (0: the first draw). */
  attempts: number;
  /** Every draw up to `maxAttempts` had a Tie: the last one was kept anyway. */
  tied: boolean;
}

/** Draw number `attempt` of `seed`. */
export function seededQueue(pool: readonly number[], seed: number, attempt: number): number[] {
  return secureShuffle(pool, seededRandom(mixSeed(seed, attempt)));
}

/** Two or more cards completing on the same landing. */
export const isTie = (win: FirstWin | null): boolean => win != null && win.cardIds.length > 1;

/** Whether the first Line or the first Bingo of `queue` is a Tie among `cards`. */
export function hasTie(cards: readonly Card[], queue: readonly number[]): boolean {
  return isTie(firstWinAt(cards, queue, 'line')) || isTie(firstWinAt(cards, queue, 'bingo'));
}

export function tieFreeShuffle({ pool, cards, seed, maxAttempts, rule = 'firstWins' }: TieFreeOptions): TieFreeShuffle {
  const last = Math.max(1, Math.floor(maxAttempts)) - 1;
  for (let attempt = 0; ; attempt++) {
    const queue = seededQueue(pool, seed, attempt);
    if (rule === 'none' || !cards.length || !hasTie(cards, queue)) return { queue, seed, attempts: attempt, tied: false };
    if (attempt >= last) return { queue, seed, attempts: attempt, tied: true };
  }
}
