// Time-driven bits of the scenes that are not animations: rough countdowns and the Interval's ring. Pure:
// the time is passed in (the show's clock, `client.now()`).

/** A countdown that only promises what is true: rounds start by hand, so it is a guide. */
export type RoughCountdown = { kind: 'at'; atMs: number } | { kind: 'minutes'; minutes: number } | { kind: 'soon' };

export interface RoughCountdownOptions {
  /** Further away than this: say the clock time instead. */
  clockAboveMin: number;
  /** Closer than this: whole minutes; further: steps of `coarseStepMin`. */
  fineBelowMin: number;
  coarseStepMin: number;
}

/** The rough countdown to `targetMs`, or null without a target. Under a minute (or overdue) is "soon". */
export function roughCountdown(targetMs: number | null, nowMs: number, options: RoughCountdownOptions): RoughCountdown | null {
  if (targetMs === null || !Number.isFinite(targetMs)) return null;
  const leftMin = (targetMs - nowMs) / 60_000;
  if (leftMin <= 1) return { kind: 'soon' };
  if (leftMin > options.clockAboveMin) return { kind: 'at', atMs: targetMs };
  if (leftMin < options.fineBelowMin) return { kind: 'minutes', minutes: Math.ceil(leftMin) };
  const step = Math.max(1, options.coarseStepMin);
  return { kind: 'minutes', minutes: Math.round(leftMin / step) * step };
}

/** Two rough countdowns say the same thing (so the chip only ticks when its text changes). */
export function sameCountdown(a: RoughCountdown | null, b: RoughCountdown | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'minutes' && b.kind === 'minutes') return a.minutes === b.minutes;
  if (a.kind === 'at' && b.kind === 'at') return a.atMs === b.atMs;
  return a.kind === b.kind;
}

/**
 * The Interval ring's share still to go, 1 → 0, from the Interval's start to its guide end (rounded to 1/1000,
 * so a 60 fps loop only writes when it moves). Null without a guide end.
 */
export function ringLeft(sinceMs: number, endMs: number | null, nowMs: number): number | null {
  if (endMs === null || !Number.isFinite(endMs)) return null;
  const span = endMs - sinceMs;
  if (span <= 0) return 0;
  const left = Math.min(1, Math.max(0, (endMs - nowMs) / span));
  return Math.round(left * 1000) / 1000;
}

/** A CSS time ("480ms", "0.4s", "0s") in ms, or `fallback` when it can't be read. */
export function parseCssTime(value: string | null | undefined, fallback: number): number {
  const m = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(value ?? '');
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  return m[2] === 's' ? n * 1000 : n;
}

/** True within `windowMs` before `landAtMs`: no optional DOM work then (ANIMATIONS.md budget). */
export function nearLanding(landAtMs: number | null, nowMs: number, windowMs: number): boolean {
  return landAtMs !== null && nowMs < landAtMs && landAtMs - nowMs <= windowMs;
}

/** `link-lost`: the link has been down (since `downSinceMs`, local clock) for at least `graceMs`. */
export function linkLost(downSinceMs: number | null, nowMs: number, graceMs: number): boolean {
  return downSinceMs !== null && nowMs - downSinceMs >= graceMs;
}
