// The Heat garland's look (ANIMATIONS.md `heat`): a string of lights that are all always on. Only their
// colour, glow and twinkle speed follow the Heat: cool white-blue with a slow twinkle, warm gold and orange,
// hot red with a faster chase. Never a bar that fills, so it can't be read as progress. The display value
// comes from ui/rules/heat.ts, which already delays and eases every change away from landings. Pure.
import { heatAt, type HeatSample } from '../../ui/rules/heat.ts';

export interface GarlandLook {
  /** 0..1: cool → gold (first half of the Heat). */
  warm: number;
  /** 0..1: gold → red (second half). */
  hot: number;
  /** 0..1: glow and brightness. */
  glow: number;
  /** Twinkle period in ms: slow when cool, quick when hot. Quantised so the CSS animation is rarely restarted. */
  twinkleMs: number;
  /** 0..1: how much the twinkle becomes a chase along the string (lights blinking in sequence). */
  chase: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function garlandLook(heat: number | null, { slowMs = 3200, fastMs = 1000, steps = 4 } = {}): GarlandLook {
  const h = clamp01(heat ?? 0);
  const step = Math.round(h * steps) / steps;
  return {
    warm: round3(clamp01(h / 0.5)),
    hot: round3(clamp01((h - 0.5) / 0.5)),
    glow: round3(h),
    twinkleMs: Math.round(slowMs + (fastMs - slowMs) * step),
    chase: step >= 0.75 ? 1 : 0,
  };
}

/**
 * The Heat to display at `nowMs`. Normally the eased value. With reduced motion, the value jumps to each
 * sample's target when it starts (the CSS fades it over 2 s instead of a 20 s ease).
 */
export function heatDisplay(samples: readonly HeatSample[], nowMs: number, reducedMotion: boolean): number {
  if (samples.length === 0) return 0;
  if (!reducedMotion) return heatAt(samples, nowMs, samples[0].value);
  const started = activeHeatSample(samples, nowMs);
  return started ? started.value : samples[0].value;
}

/** The latest sample that has started by `nowMs` (its `fromMs` is the `heat` moment), or null. */
export function activeHeatSample(samples: readonly HeatSample[], nowMs: number): HeatSample | null {
  let best: HeatSample | null = null;
  for (const s of samples) if (s.fromMs <= nowMs && (!best || s.fromMs > best.fromMs)) best = s;
  return best;
}
