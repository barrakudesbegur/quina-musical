// The Heat garland's look (ANIMATIONS.md `heat` and "The garland's lights", D-t): a string of bulbs whose colour and
// glow follow the Heat, and whose lights play a pattern for its level (packages/ui/motion/garland.ts, shared with the
// phones): breathing when cool, a wave when warm, a chase when hot, flames when very hot, and the party colours in a
// Celebration (`win`). Never a bar that fills, so it can't be read as progress. The display value comes from
// packages/rules/heat.ts, which already delays and eases every change away from landings. Pure.
import { STAGE } from '../config.ts';
import { heatAt, type HeatSample } from '../../../packages/rules/heat.ts';
import { garlandLights, type GarlandLights, type GarlandShape } from '../../../packages/ui/motion/garland.ts';

export interface GarlandLook {
  /** 0..1: cool → gold (first half of the Heat). */
  warm: number;
  /** 0..1: gold → red (second half). */
  hot: number;
  /** 0..1: glow and brightness. */
  glow: number;
  /** The pattern, its period, the palette and the flames. */
  lights: GarlandLights;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The look for a Heat (null: before any sample, a calm glow) in play (`live`) or a Celebration (`win`). */
export function garlandLook(heat: number | null, mood: 'live' | 'win' = 'live'): GarlandLook {
  const h = clamp01(heat ?? 0);
  return {
    warm: round3(clamp01(h / 0.5)),
    hot: round3(clamp01((h - 0.5) / 0.5)),
    glow: round3(h),
    lights: garlandLights(h, mood),
  };
}

/**
 * The Heat to display at `nowMs`. Normally the eased value. With reduced motion, the value jumps to each
 * sample's target when it starts (the CSS fades it over 2 s instead of a 20 s ease).
 */
export function heatDisplay(samples: readonly HeatSample[], nowMs: number, reducedMotion: boolean, neutral = STAGE.heatNeutral): number {
  // Until a sample starts, a calm neutral glow: never the target before its time (a page loaded mid-round
  // must not jump straight to it).
  if (!reducedMotion) return heatAt(samples, nowMs, neutral);
  return activeHeatSample(samples, nowMs)?.value ?? neutral;
}

/** The latest sample that has started by `nowMs` (its `fromMs` is the `heat` moment), or null. */
export function activeHeatSample(samples: readonly HeatSample[], nowMs: number): HeatSample | null {
  let best: HeatSample | null = null;
  for (const s of samples) if (s.fromMs <= nowMs && (!best || s.fromMs > best.fromMs)) best = s;
  return best;
}

/** The garland drawn with its wings: the whole string, where the box's part starts, and its first bulb's index. */
export interface GarlandWings {
  /** The whole string, wings included, for `garlandLayout`. */
  shape: GarlandShape;
  /** How far each wing reaches past the box's side (px). */
  wing: number;
  /** The index of the string's first bulb: the left wing's bulbs count up to 0, where the box's start. */
  first: number;
}

/**
 * `wingSwags` more swags past each side of the box's garland (D276: 16:10 and 16:9 screens), in the same swags and
 * bulb spacing, so the box's part is drawn exactly as without wings. A wing that wouldn't hold a whole number of
 * bulbs is left out (its spacing would drift).
 */
export function garlandWings(shape: GarlandShape, wingSwags: number): GarlandWings {
  const swags = Math.max(1, Math.round(shape.swags));
  const wings = Math.max(0, Math.round(wingSwags));
  const wingBulbs = (shape.bulbs * wings) / swags;
  if (wings === 0 || !Number.isInteger(wingBulbs)) return { shape, wing: 0, first: 0 };
  const wing = (shape.width * wings) / swags;
  return {
    shape: { ...shape, width: shape.width + 2 * wing, swags: swags + 2 * wings, bulbs: shape.bulbs + 2 * wingBulbs },
    wing,
    first: -wingBulbs,
  };
}
