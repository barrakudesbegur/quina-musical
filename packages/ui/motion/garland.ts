// The Heat garland, shared by the phones and the projector (ANIMATIONS.md "The garland's lights", D-t): the wire
// hanging in swags with its bulbs, which light pattern plays for a Heat and a mood, and each bulb's part in it.
// Pure: the apps draw it with CSS keyframes, each bulb's part set once as custom properties, never per frame.

export interface GarlandShape {
  /** The design width in px. */
  width: number;
  swags: number;
  bulbs: number;
  /** The wire's height at the hooks, and how far each swag sags below it, in px. */
  top: number;
  sag: number;
}

export interface GarlandLight {
  /** Across the width, 0..1. */
  x: number;
  /** Where the light hangs from the wire, in px from the top. */
  y: number;
  /** Tilt in degrees: half the wire's slope there. */
  angle: number;
}

export interface GarlandLayout {
  /** An SVG path in a `width` × (top + sag) box: one quadratic curve per swag (a parabola, sagging `sag`). */
  wire: string;
  lights: GarlandLight[];
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

export function garlandLayout({ width, swags, bulbs, top, sag }: GarlandShape): GarlandLayout {
  const n = Math.max(1, Math.round(swags));
  const seg = width / n;
  const curves = Array.from({ length: n }, (_, i) => `Q${round(seg * (i + 0.5))} ${round(top + 2 * sag)} ${round(seg * (i + 1))} ${top}`);
  const lights = Array.from({ length: Math.max(0, Math.round(bulbs)) }, (_, i) => {
    const px = ((i + 0.5) * width) / bulbs;
    const t = (px % seg) / seg;
    const slope = (sag * 4 * (1 - 2 * t)) / seg;
    return { x: round(px / width, 4), y: round(top + sag * 4 * t * (1 - t)), angle: round(((Math.atan(slope) * 180) / Math.PI) * 0.5, 1) };
  });
  return { wire: `M0 ${top}${curves.join('')}`, lights };
}

// ---- the lights ------------------------------------------------------------------------------------------

/** The Heat's level, as the phones name it ("Tranquil·la" … "Que crema!"). */
export type HeatLevel = 'cold' | 'warm' | 'hot' | 'fire';

/** Where each level starts. */
export const HEAT_LEVELS: Readonly<Record<Exclude<HeatLevel, 'cold'>, number>> = Object.freeze({ warm: 0.25, hot: 0.5, fire: 0.75 });

export function heatLevel(value: number): HeatLevel {
  if (value < HEAT_LEVELS.warm) return 'cold';
  if (value < HEAT_LEVELS.hot) return 'warm';
  if (value < HEAT_LEVELS.fire) return 'hot';
  return 'fire';
}

/**
 * What the garland is showing: `live` (the Heat), `idle` (no Heat yet: calm decoration), `off` (offline: the
 * lights out), `party` (a phone's `your-song`), `win` (a Celebration).
 */
export type GarlandMood = 'live' | 'idle' | 'off' | 'party' | 'win';

export type GarlandPattern = 'none' | 'breathe' | 'wave' | 'chase' | 'fire' | 'party' | 'win';

export interface GarlandLights {
  level: HeatLevel;
  pattern: GarlandPattern;
  /** One cycle of the pattern, in ms. */
  periodMs: number;
  /** `heat`: the three tones mixed by the Heat; `party`: the six party colours along the string. */
  palette: 'heat' | 'party';
  /** Flames behind some bulbs (very hot). */
  fire: boolean;
}

/** Each pattern's cycle in ms: `party` by Heat level, the others fixed (ANIMATIONS.md's table). */
export const GARLAND_PERIOD_MS = Object.freeze({
  idle: 4000,
  breathe: 3200,
  wave: 2400,
  chase: 1600,
  fire: 1100,
  win: 1400,
  party: Object.freeze({ cold: 2400, warm: 1800, hot: 1400, fire: 1100 }) as Readonly<Record<HeatLevel, number>>,
});

/** How often a bulb (or a `party` group) goes from lit to dark in one cycle: WCAG 2.3.1 allows 3 flashes a second. */
export const GARLAND_FLASHES_PER_CYCLE: Readonly<Record<GarlandPattern, number>> = Object.freeze({
  none: 0,
  breathe: 0,
  wave: 0,
  chase: 1,
  fire: 0,
  party: 1,
  win: 1,
});

const HEAT_PATTERN: Readonly<Record<HeatLevel, Exclude<GarlandPattern, 'none' | 'party' | 'win'>>> = { cold: 'breathe', warm: 'wave', hot: 'chase', fire: 'fire' };

/** The pattern for a Heat (0..1, clamped) and a mood. */
export function garlandLights(heat: number, mood: GarlandMood): GarlandLights {
  const level = heatLevel(Math.min(1, Math.max(0, Number.isFinite(heat) ? heat : 0)));
  const fire = level === 'fire';
  switch (mood) {
    case 'off':
      return { level, pattern: 'none', periodMs: 0, palette: 'heat', fire: false };
    case 'idle':
      return { level, pattern: 'breathe', periodMs: GARLAND_PERIOD_MS.idle, palette: 'heat', fire: false };
    case 'party':
      return { level, pattern: 'party', periodMs: GARLAND_PERIOD_MS.party[level], palette: 'party', fire };
    case 'win':
      return { level, pattern: 'win', periodMs: GARLAND_PERIOD_MS.win, palette: 'party', fire };
    case 'live': {
      const pattern = HEAT_PATTERN[level];
      return { level, pattern, periodMs: GARLAND_PERIOD_MS[pattern], palette: 'heat', fire };
    }
  }
}

/** The party colours, in order along the string (packages/ui/tokens.css colour names). */
export const PARTY_COLORS = Object.freeze(['red', 'orange', 'gold', 'green', 'cyan', 'purple'] as const);
export type PartyColor = (typeof PARTY_COLORS)[number];

export interface GarlandBulb {
  /** Its place on the string, 0-based (below 0 in the projector's left wing): the `wave` and `win` runs. */
  index: number;
  /** 0, 1 or 2: its heat tone, its `party` group and its `chase` step. */
  step: 0 | 1 | 2;
  /** 0..1, random: its own phase in `breathe`, its own speed in `fire`. */
  seed: number;
  /** Its colour in the party palette. */
  party: PartyColor;
  /** It has a flame when very hot. */
  flame: boolean;
}

/** `v` mod `n`, never negative (a bulb before the first keeps the string's order). */
const wrap = (v: number, n: number) => ((v % n) + n) % n;

/**
 * Each bulb's part in the patterns. Flames go behind every `flameEvery`-th bulb, starting with the second, so the
 * two ends stay clear (phones 3: 4 flames on 13 bulbs; the projector 2: 17 on 34). `first` numbers the string from
 * another bulb: the projector's wings past a 4:3 box start below 0 (`first: -17`), so the box's own bulbs keep their
 * index, step, colour and flame, and the order runs on unbroken into the wings.
 */
export function garlandBulbs(count: number, flameEvery: number, random: () => number, first = 0): GarlandBulb[] {
  const every = Math.max(1, Math.round(flameEvery));
  return Array.from({ length: Math.max(0, Math.round(count)) }, (_, i) => {
    const index = first + i;
    return {
      index,
      step: wrap(index, 3) as 0 | 1 | 2,
      seed: Math.round(Math.min(1, Math.max(0, random())) * 1000) / 1000,
      party: PARTY_COLORS[wrap(index, PARTY_COLORS.length)],
      flame: wrap(index, every) === 1 % every,
    };
  });
}
