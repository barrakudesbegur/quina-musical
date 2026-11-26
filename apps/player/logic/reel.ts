// The home screen's drum, synced to the projector's Spin on the cloud's clock: a ring of cover tiles (board
// Mobil-B-J2). The tiles show songs still to come, in an order that has nothing to do with the Queue, blurred while
// it turns; the landed song shows once its landing is public, never before (the feed doesn't carry the target).
// `offset` is how many tiles have passed: it speeds up, cruises, and slows so it stops exactly at `landAtMs`.
// A Suspense (`landAtMs: null`) coasts slowly until released. Pure.
import { PLAYER_CONFIG } from '../config.ts';
import type { PublicLanding, PublicSpin } from '../feed/public.ts';

export type ReelPhase =
  /** Nothing has landed yet this round, and nothing spins. */
  | 'idle'
  | 'spinning'
  /** A Suspense: coasting until it is released. */
  | 'coasting'
  /** Stopped at `landAtMs`, the landing not public yet. */
  | 'stopped'
  /** The latest landing is public: show its cover. */
  | 'landed';

export interface ReelState {
  phase: ReelPhase;
  offset: number;
}

export interface ReelOptions {
  speed: number;
  rampUpMs: number;
  rampDownMs: number;
  coastSpeed: number;
}

const DEFAULTS: ReelOptions = {
  speed: PLAYER_CONFIG.reelSpeed,
  rampUpMs: PLAYER_CONFIG.reelRampUpMs,
  rampDownMs: PLAYER_CONFIG.reelRampDownMs,
  coastSpeed: PLAYER_CONFIG.reelCoastSpeed,
};

/** Card backs passed `t` ms into a Spin of `total` ms: up-ramp, cruise, down-ramp to 0 at `total`. */
export function reelOffset(t: number, total: number, { speed, rampUpMs, rampDownMs }: ReelOptions = DEFAULTS): number {
  if (total <= 0) return 0;
  const v = speed / 1000;
  const a = Math.min(rampUpMs, total / 3);
  const d = Math.min(rampDownMs, total / 2);
  const tt = Math.min(Math.max(t, 0), total);
  if (tt < a) return (v * tt * tt) / (2 * a);
  const up = (v * a) / 2;
  if (tt < total - d) return up + v * (tt - a);
  const cruise = v * (total - d - a);
  const x = tt - (total - d);
  return up + cruise + v * x - (v * x * x) / (2 * d);
}

/** Where the reel is now. */
export function reelState(spin: PublicSpin | null, latest: PublicLanding | null, nowMs: number, options: ReelOptions = DEFAULTS): ReelState {
  if (latest && (!spin || latest.atMs >= spin.startAtMs)) return { phase: 'landed', offset: 0 };
  if (!spin) return { phase: 'idle', offset: 0 };
  const t = nowMs - spin.startAtMs;
  if (spin.landAtMs === null) return { phase: 'coasting', offset: (Math.max(0, t) * options.coastSpeed) / 1000 };
  const total = spin.landAtMs - spin.startAtMs;
  if (nowMs >= spin.landAtMs) return { phase: 'stopped', offset: reelOffset(total, total, options) };
  return { phase: 'spinning', offset: reelOffset(t, total, options) };
}

/** The drum's ring: ten tiles, 36° apart (board Mobil-B-J2). */
export const DRUM_TILES = 10;

/** A small seeded generator (mulberry32), so a round's tiles keep their order between renders. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The song on each of the drum's tiles: songs still to come this round, never a landed one. The order is a shuffle
 * seeded by the round, with nothing to do with the Queue. Each tile keeps its song until that song lands, then takes
 * the next one along its own chain, so a landing changes one tile, not all of them. `null` when no song is left.
 */
export function drumSongs(songIds: Iterable<number>, landed: ReadonlySet<number>, seed: number, tiles = DRUM_TILES): (number | null)[] {
  const all = [...new Set(songIds)].sort((a, b) => a - b);
  const random = seeded(seed);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j] as number, all[i] as number];
  }
  const left = all.filter((id) => !landed.has(id));
  return Array.from({ length: tiles }, (_, i) => {
    for (let j = i; j < all.length; j += tiles) if (!landed.has(all[j] as number)) return all[j] as number;
    return left.length ? (left[i % left.length] as number) : null;
  });
}

/** How far the ring has turned, in tiles, `offset` tiles into a Spin that ends after `final`: scaled so it stops on a whole tile. */
export function drumTurn(offset: number, final: number | null): number {
  if (final === null || final < 0.5) return offset;
  return offset * (Math.round(final) / final);
}
