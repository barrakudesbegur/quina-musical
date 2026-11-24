// The console's countdowns, all from the engine's epoch-ms times and the show laptop's clock (`store.now`):
// - the next auto-advance (state.autoAtMs), as a ring on Now playing;
// - the next song's landing while a transition runs (state.transition.landAtMs);
// - a Suspense's auto-release (state.suspense.autoReleaseAtMs);
// - Hold music taking over (state.hold.holdMusicAtMs);
// - the Interval's guide (flow.interval.guideEndMs), which may run over.
// Pure.
import type { ShowState } from '@quina/protocol';
import { secondsLeft } from '../../../packages/rules/time.ts';
import type { IntervalInfo, ShuffleInfo } from '../../../packages/ui/flow.ts';

export interface Countdown {
  /** Whole seconds left, rounded up (never negative). */
  secondsLeft: number;
  /** The share of the span still to go: 1 at the start, 0 at the end. */
  remaining: number;
  done: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A countdown over [startMs, endMs]. A span of zero or less reads as done at `endMs`. */
export function countdownBetween(startMs: number, endMs: number, nowMs: number): Countdown {
  const span = endMs - startMs;
  const remaining = span > 0 ? clamp01((endMs - nowMs) / span) : nowMs < endMs ? 1 : 0;
  return { secondsLeft: secondsLeft(endMs, nowMs) ?? 0, remaining, done: nowMs >= endMs };
}

/** When the last counted song landed, or null. */
export function lastLandingAtMs(state: ShowState): number | null {
  for (let i = state.landings.length - 1; i >= 0; i--) if (!state.landings[i].undone) return state.landings[i].atMs;
  return null;
}

/** Why the auto-advance ring is running or not. */
export type AutoAdvance = 'running' | 'off' | 'offFinal' | 'held' | 'spinning' | 'waiting';

export function autoAdvanceStatus(state: ShowState): AutoAdvance {
  if (state.autoAtMs !== null) return 'running';
  if (state.status === 'transition') return 'spinning';
  if (state.status === 'hold') return 'held';
  if (!state.game.autoAdvance) return 'off';
  if (state.phase === 'final' && !state.game.autoAdvanceFinal) return 'offFinal';
  return 'waiting';
}

/**
 * The ring to the next auto-advance: it starts full at the last landing and empties at `autoAtMs`. When the
 * landing is unknown (or after `autoAtMs`), the span is the Pace's slot.
 */
export function autoAdvanceCountdown(state: ShowState, nowMs: number): Countdown | null {
  const end = state.autoAtMs;
  if (end === null) return null;
  const landed = lastLandingAtMs(state);
  const start = landed !== null && landed < end ? landed : end - state.pace.slotSec * 1000;
  return countdownBetween(start, end, nowMs);
}

/** The incoming song's landing, while a transition runs. The span is the planned Spin. */
export function landingCountdown(state: ShowState, nowMs: number): Countdown | null {
  const t = state.transition;
  if (!t) return null;
  return countdownBetween(t.landAtMs - state.pace.spinSec * 1000, t.landAtMs, nowMs);
}

/** An open Suspense: from its start to its auto-release. `remaining` empties as the release nears. */
export function suspenseCountdown(state: ShowState, nowMs: number): Countdown | null {
  const s = state.suspense;
  if (!s) return null;
  return countdownBetween(s.sinceMs, s.autoReleaseAtMs, nowMs);
}

/** Hold music taking over, during a Hold that hasn't switched yet. */
export function holdMusicCountdown(state: ShowState, nowMs: number): Countdown | null {
  const h = state.hold;
  if (!h || h.holdMusic || h.holdMusicAtMs === null) return null;
  return countdownBetween(h.sinceMs, h.holdMusicAtMs, nowMs);
}

/** The Shuffle's animation, while it runs. */
export function shuffleCountdown(shuffle: ShuffleInfo | null, nowMs: number): Countdown | null {
  if (!shuffle || nowMs >= shuffle.endAtMs) return null;
  return countdownBetween(shuffle.startAtMs, shuffle.endAtMs, nowMs);
}

export interface GuideCountdown extends Countdown {
  /** Seconds past the guide's end (0 before it): rounds always start by hand, so it may run over. */
  overSec: number;
}

/** The Interval's guide countdown. */
export function guideCountdown(interval: IntervalInfo | null, nowMs: number): GuideCountdown | null {
  if (!interval) return null;
  const base = countdownBetween(interval.sinceMs, interval.guideEndMs, nowMs);
  return { ...base, overSec: Math.max(0, Math.floor((nowMs - interval.guideEndMs) / 1000)) };
}

/** Whole seconds since `sinceMs` (never negative). */
export function elapsedSec(sinceMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - sinceMs) / 1000));
}
