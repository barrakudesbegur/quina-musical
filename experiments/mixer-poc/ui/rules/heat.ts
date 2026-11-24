// Heat on screen: how hot the round looks. The engine's `heat` is already blurred so it never tells how many
// songs are left. This module makes sure the display never moves at a landing either:
// - A new target becomes a sample that starts easing a random 4–15 s later and takes about 20 s to arrive.
// - The projector and the phones run the same `heatAt`, so they agree.
// Pure: the random source and the clock are passed in.

export interface HeatSample {
  /** The target value, 0..1. */
  value: number;
  /** When the easing towards it starts (epoch ms). */
  fromMs: number;
  /** When it arrives. */
  toMs: number;
}

export const HEAT = Object.freeze({
  /** Random delay before a new target starts to show, so it never lines up with a landing. */
  delayMinMs: 4000,
  delayMaxMs: 15000,
  /** How long the easing towards a new target takes. */
  easeMs: 20000,
  /** Changes smaller than this are ignored (no restless display). */
  minStep: 0.02,
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The displayed Heat at `nowMs`, from samples in any order. `initial` is the value before the first sample. */
export function heatAt(samples: readonly HeatSample[], nowMs: number, initial = 0): number {
  const sorted = [...samples].sort((a, b) => a.fromMs - b.fromMs);
  let value = clamp01(initial);
  for (const s of sorted) {
    if (nowMs <= s.fromMs) break;
    if (nowMs >= s.toMs || s.toMs <= s.fromMs) {
      value = clamp01(s.value);
      continue;
    }
    const t = smooth((nowMs - s.fromMs) / (s.toMs - s.fromMs));
    value = value + (clamp01(s.value) - value) * t;
    break;
  }
  return value;
}

/**
 * Turns the engine's Heat targets into display samples. Feed it every `state.heat` you receive. It adds a
 * sample only when the target really changes, with a random start delay, so the display never reacts at
 * the moment of a landing.
 */
export class HeatSmoother {
  samples: HeatSample[] = [];
  private target: number | null = null;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** A new target from the engine at `nowMs`. Returns true when it added a sample. */
  push(value: number | null, nowMs: number): boolean {
    if (value === null || !Number.isFinite(value)) return false;
    const v = clamp01(value);
    if (this.target !== null && Math.abs(v - this.target) < HEAT.minStep) return false;
    this.target = v;
    const fromMs = nowMs + HEAT.delayMinMs + this.random() * (HEAT.delayMaxMs - HEAT.delayMinMs);
    this.samples.push({ value: v, fromMs, toMs: fromMs + HEAT.easeMs });
    // Keep the history short: everything that has fully arrived before the newest sample can go.
    while (this.samples.length > 8) this.samples.shift();
    return true;
  }

  at(nowMs: number): number {
    return heatAt(this.samples, nowMs, this.samples[0]?.value ?? 0);
  }
}
