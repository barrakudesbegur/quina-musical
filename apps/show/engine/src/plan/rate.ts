// Playback-rate ramps, pure: how far a source advances while its rate ramps, and when it gets somewhere. P5's
// rate-aware landing (D14's tape start) and D7's pitch-up rush use them; the Deck uses the same numbers to start
// B so its pickup still sounds at P while its rate climbs.
//
// An exponential ramp from `from` to `to` over `dur` seconds is r(t) = from·(to/from)^(t/dur), the curve
// AudioParam.exponentialRampToValueAtTime draws.

/** A rate ramp a source follows over [t0, t1] (context seconds), as AudioParam automation draws it. */
export interface RateRamp {
  t0: number;
  t1: number;
  from: number;
  to: number;
  curve: 'lin' | 'exp';
}

/**
 * Song seconds a source advances over `dur` while its rate ramps exponentially from `from` to `to`.
 * @param from  > 0
 * @param to    > 0
 */
export function expRampAdvance(from: number, to: number, dur: number): number {
  if (dur <= 0) return 0;
  if (Math.abs(to - from) < 1e-12) return from * dur;
  return (dur * (to - from)) / Math.log(to / from);
}

/**
 * Seconds after the ramp's start at which the source has advanced `x` song seconds (the inverse of
 * expRampAdvance for 0 ≤ x ≤ its advance over the whole ramp).
 */
export function expRampTimeAt(from: number, to: number, dur: number, x: number): number {
  if (dur <= 0 || x <= 0) return 0;
  if (Math.abs(to - from) < 1e-12) return x / from;
  const k = Math.log(to / from) / dur;
  return Math.log(1 + (x * k) / from) / k;
}

/**
 * Song seconds a source advances from the ramp's start until `t` (any time: held at `from` before the ramp and at
 * `to` after it).
 */
export function rampAdvanceUntil(r: RateRamp, t: number): number {
  if (t <= r.t0) return 0;
  const dur = r.t1 - r.t0;
  const within = Math.min(t, r.t1) - r.t0;
  let advance: number;
  if (r.curve === 'exp') {
    // The part of an exponential ramp up to `within` is itself an exponential ramp to the rate reached then.
    const reached = dur > 0 ? r.from * (r.to / r.from) ** (within / dur) : r.to;
    advance = expRampAdvance(r.from, reached, within);
  } else {
    const reached = dur > 0 ? r.from + ((r.to - r.from) * within) / dur : r.to;
    advance = ((r.from + reached) / 2) * within;
  }
  return advance + Math.max(0, t - r.t1) * r.to;
}

/**
 * When a source following `r` reaches `x` song seconds past where it was at the ramp's start (the inverse of
 * rampAdvanceUntil after t0; exponential ramps only within the ramp, then at `to`).
 */
export function rampTimeAt(r: RateRamp, x: number): number {
  const whole = rampAdvanceUntil(r, r.t1);
  if (x >= whole) return r.t1 + (x - whole) / r.to;
  const dur = r.t1 - r.t0;
  if (r.curve === 'exp') return r.t0 + expRampTimeAt(r.from, r.to, dur, x);
  // Linear: x = from·u + (to − from)·u²/(2·dur), solved for u.
  const a = (r.to - r.from) / (2 * dur);
  if (Math.abs(a) < 1e-12) return r.t0 + x / r.from;
  return r.t0 + (-r.from + Math.sqrt(r.from * r.from + 4 * a * x)) / (2 * a);
}

/**
 * P5: where to start a source so that, ramping from `from` up to rate `to` by `until`, it plays song position
 * `virtualOffset + (until − when)·to` at `until` — the position a source started at `when` at rate `to` would
 * have reached. `quantumSec` is the render quantum (128 frames): AudioBufferSourceNode reads its k-rate
 * playbackRate once per quantum, at the quantum's start, so on a rising ramp it lags the continuous integral by
 * about half a quantum of the rate's climb; the start offset makes that up.
 */
export function powerUpOffset({ virtualOffset, when, until, from, to = 1, quantumSec = 0 }: {
  virtualOffset: number; when: number; until: number; from: number; to?: number; quantumSec?: number;
}): number {
  const dur = until - when;
  return virtualOffset + dur * to - expRampAdvance(from, to, dur) + ((to - from) * quantumSec) / 2;
}
