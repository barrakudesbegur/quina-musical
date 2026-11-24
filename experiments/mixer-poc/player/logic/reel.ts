// The Ara tab's reel, synced to the projector's Spin on the cloud's clock. It shows generic card backs only:
// the song appears once its landing is public, never before (the feed doesn't carry the target anyway).
// `offset` is how many card backs have passed: it speeds up, cruises, and slows so it stops exactly at
// `landAtMs`. A Suspense (`landAtMs: null`) coasts slowly until released. Pure.
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
