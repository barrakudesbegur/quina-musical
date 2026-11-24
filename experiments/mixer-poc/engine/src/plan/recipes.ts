// Transition recipes. Each one is pure: it returns abstract timed events (plan/events.ts) that
// scheduler.ts maps onto Web Audio. Times are AudioContext seconds. A = outgoing deck, B = incoming deck,
// T = the moment B's hook downbeat sounds (and the drum locks). Every recipe is a DJ move with effects —
// never a bare volume change — and every landing gets a landing layer and an impact (plan/landing.ts).
//
// The DJ techniques D1–D19 come from docs/dj-techniques.md; their moves are in plan/moves.ts (A's side),
// plan/layers.ts (B's side) and plan/bridges.ts (the S2 builds). Tunables are in config.ts MOVES.
import { LAYERING, MOVES } from '../config.ts';
import type { PhaseEffects, PhaseName } from '../config.ts';
import type { ExitName, RecipeFamily, RecipeId, RecipeShape } from '@quina/protocol';
import { weightedPick } from '../rng.ts';
import { OPEN_LPF, SILENT, dbToGain, pick, ramp, set, sfx, synth } from './events.ts';
import type { LanePart, PlanEvent, Slice, StemName, StemParts, BlendEvent } from './events.ts';
import { bridgeLayers, buildLayers, chooseBridge } from './bridges.ts';
import type { BridgePattern } from './bridges.ts';
import { impactLayer, swellLayer } from './landing.ts';
import type { Landing } from './landing.ts';
import { RIFF_VARIANTS, SCRATCH_STYLES, chopSlices, riffBed, scratchMove } from './layers.ts';
import type { ChopSource, LayerName, RiffSource } from './layers.ts';
import {
  GATE_MODES, PEEL_ORDERS, aGrid, brakerMove, fitBars, gateMove, peelMove, rushMove, singsBefore, spiralMove, stabsMove, vocalThrow,
} from './moves.ts';
import type { LaneWindow, OutgoingDeck } from './moves.ts';
import type { HookGrid, Timeline } from './timeline.ts';

// The transition vocabulary is part of the show protocol. Shapes: S1 rides A and lands on its downbeat,
// S2 bridges on B's grid, S3 layers B (stretched to A's tempo) under A and lands on A's downbeat, S0 is
// the fallback without a downbeat. Rotation never plays one family three times in a row.
export type { ExitName, RecipeFamily, RecipeId, RecipeShape } from '@quina/protocol';
export * from './events.ts';
export { buildLayers } from './bridges.ts';
export { impactLayer } from './landing.ts';
export type { LaneWindow, OutgoingDeck, StemBars } from './moves.ts';

// ------------------------------------------------------------------------------------------ A exits
// Each exit ends with A silent at `end`, returns { events, aStopAt }. `lead(tl, i)` = seconds before `end`
// the move needs (so the planner can keep it after the spin starts).

/**
 * What an exit move receives. `i` (A's exit downbeat index) and `rng` are required only by the moves
 * that read them (their own parameter type says so); the rest are per-move options.
 */
export interface ExitArgs {
  A: OutgoingDeck;
  end: number;
  i?: number;
  rng?: () => number;
  tailBeats?: number;
  bars?: number;
  dur?: number;
  /** The echo's delay in A's beats (drawn when left out). */
  delayBeats?: number;
  phase?: PhaseName;
  /** A forced variant of the move (tests): a gate mode, or 'down' / 'up' for the spiral. */
  variant?: string | null;
}

export interface ExitResult {
  events: PlanEvent[];
  aStopAt: number;
}

/** One way for A to leave. Method syntax on purpose: a move may require more of ExitArgs than the rest. */
export interface ExitMove {
  lead(tl: Timeline, i: number): number;
  build(args: ExitArgs): ExitResult;
}

/** Options of the loop roll (R4's variants). */
export interface RollOptions {
  /** Roll the last beat of the bar instead of its first. */
  lastBeat?: boolean;
  /** A triplet ladder (⅓ → ⅙ → 1/12 → 1/24 beat) instead of the straight one. */
  triplet?: boolean;
  /** The slices' playback rate climbs to this (P2): the roll pitches up. */
  rateTo?: number;
}

export const EXITS = {
  // Tempo-synced echo-out with a rising high-pass on A and on the echo return.
  echo: {
    lead: (tl, i) => (tl.barAt(i) > 2.5 ? 2 * tl.beatAt(i) : tl.barAt(i)),
    build({ A, i, end, tailBeats = 2, rng, delayBeats }: ExitArgs & { i: number; rng: () => number }) {
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      const start = end - (barA > 2.5 ? 2 * beatA : barA);
      const delay = delayBeats ?? (rng() < 0.65 ? 0.5 : 0.75);
      return {
        aStopAt: end + 0.05,
        events: [
          set('echo.time', start, delay * beatA),
          set('echo.feedback', start, 0.5),
          set('echo.return', start, 1),
          ramp('echo.hpf', start, end + tailBeats * beatA, 200, 2000, 'exp'),
          ramp('A.echoSend', start, start + beatA / 2, 0, 0.55, 'lin'),
          ramp('A.hpf', start, end, 20, 450, 'exp'),
          ramp('A.gain', end - beatA, end, A.level, SILENT, 'lin'),
          ramp('echo.return', end + tailBeats * beatA, end + (tailBeats + 1) * beatA, 1, SILENT, 'lin'),
          set('echo.return', end + (tailBeats + 1.5) * beatA, 1),
          set('echo.feedback', end + (tailBeats + 1.5) * beatA, 0),
        ],
      };
    },
  },

  // Loop roll: A's bar repeats in shrinking slices (1 → ½ → ¼ → ⅛ → 1/16 beat), filter opening upward.
  roll: {
    lead: (tl, i) => tl.barAt(i),
    build({ A, i, end, bars = 1, lastBeat = false, triplet = false, rateTo = 1 }: ExitArgs & { i: number } & RollOptions) {
      const beatA = A.tl.beatAt(i);
      const bpb = A.tl.bpb;
      const rollStart = end - bars * bpb * beatA;
      const offset = A.tl.posAt(lastBeat ? end - beatA : rollStart);
      const plan: [number, number][] = []; // [slice length in beats, count]
      if (bars >= 2) plan.push([1, bpb]);
      if (triplet) plan.push([1 / 3, 3], [1 / 6, 6], [1 / 12, 12], [1 / 24, 12]);
      else plan.push([0.5, 2], [0.25, 4], [0.125, 8], [0.0625, 8]);
      const total = plan.reduce((n, [, count]) => n + count, 0);
      const slices: Slice[] = [];
      let at = rollStart;
      let k = 0;
      for (const [len, count] of plan) {
        for (let c = 0; c < count; c++) {
          const dur = len * beatA;
          const u = k / Math.max(1, total - 1);
          slices.push({ at, offset, dur, gain: 0.8 + 0.2 * u, ...(rateTo !== 1 ? { rate: 1 + (rateTo - 1) * u } : {}) });
          at += dur;
          k++;
        }
      }
      // Whatever is left of the last beat stays silent: the gap before the hit.
      return {
        aStopAt: rollStart,
        events: [
          set('A.gain', rollStart, 1),
          ramp('A.hpf', rollStart, end, 20, 900, 'exp'),
          { kind: 'slices', deck: 'A', slices },
          set('A.gain', end, SILENT),
        ],
      };
    },
  },

  // Tape-stop brake: playback rate to zero with a closing low-pass and a falling noise sweep.
  brake: {
    lead: () => 0.9,
    build({ A, end, dur = 0.8 }) {
      const start = end - dur;
      return {
        aStopAt: end + 0.05,
        events: [
          set('A.gain', start, Math.max(A.level, 0.8)),
          ramp('A.rate', start, end, 1, 0.02, 'lin'),
          ramp('A.lpf', start, end, OPEN_LPF, 500, 'exp'),
          ramp('A.gain', end - 0.12, end, Math.max(A.level, 0.8), SILENT, 'lin'),
          synth('downlifter', { t0: start, t1: end + 0.2, peakDb: -16 }),
        ],
      };
    },
  },

  // Spinback: A rewinds (reversed, fast, slowing down) — the classic "pull up".
  spinback: {
    lead: () => 1.1,
    build({ A, end, dur = 1.0 }) {
      const start = end - dur;
      return {
        aStopAt: start + 0.005,
        events: [
          set('A.gain', start, 1),
          { kind: 'spinback', deck: 'A', at: start, fromPos: A.tl.posAt(start), seconds: 1.6, rateFrom: 3, dur },
          ramp('A.hpf', start, end, 20, 250, 'exp'),
          set('A.gain', end + 0.02, SILENT),
        ],
      };
    },
  },

  // Reverb wash: A dissolves into a big high-passed reverb.
  wash: {
    lead: (tl, i) => tl.barAt(i),
    build({ A, i, end }: ExitArgs & { i: number }) {
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      const start = end - barA;
      return {
        aStopAt: end + 0.05,
        events: [
          set('reverb.return', start, 1),
          ramp('A.reverbSend', start, start + barA / 2, 0, 0.85, 'lin'),
          ramp('A.hpf', start, end, 20, 350, 'exp'),
          ramp('A.gain', end - beatA, end, A.level, SILENT, 'lin'),
        ],
      };
    },
  },

  // D1 as an exit: one bar of the mid gate ladder (or the pump) into the bridge.
  gate: {
    lead: (tl, i) => tl.barAt(i),
    build({ A, i, end, rng, phase = 'mid', variant = null }: ExitArgs & { i: number; rng: () => number }) {
      const mode = GATE_MODES.find((m) => m === variant) ?? null;
      const move = gateMove({ A, i, end, bars: 1, phase, rng, mode, exit: true });
      return { aStopAt: end + 0.05, events: move.events };
    },
  },

  // D3 as an exit: one bar of spiral; sometimes it spirals down instead, since a bridge follows.
  spiral: {
    lead: (tl, i) => tl.barAt(i),
    build({ A, i, end, rng, phase = 'mid', variant = null }: ExitArgs & { i: number; rng: () => number }) {
      const down = variant === 'down' || (variant !== 'up' && rng() < MOVES.spiral.downChance);
      const move = spiralMove({ A, i, end, bars: 1, phase, rng, down, restoreAt: end + 0.3 });
      return { aStopAt: end + 0.05, events: move.events };
    },
  },
} satisfies Record<ExitName, ExitMove>;

// -------------------------------------------------------------------------------------- B landings
// B: hook downbeat at T. `pickupAt` = T − pickup (B is fully open from there). Optional Tease before the
// landing, cut to silence for the gap, then the full song bursts in on the pickup:
//  - from B's own stems when they cover the hook: its drums come in, then its bass for the last bar, at
//    B's tempo and phase-locked to the hook (a DJ bringing in the next track's groove);
//  - otherwise B's full mix through a closed low-pass.
/** What a landing of B needs from the recipe's BuildArgs. */
export type LandingArgs = Pick<BuildArgs, 'T' | 'pickupAt' | 'gapStart' | 'bStart' | 'teaseFrom' | 'tease' | 'teaseStems' | 'gB' | 'phase' | 'landing'>;

/**
 * The Tease and B's entry, then the impact. A stem Tease plays from `teaseFrom` (B's own clock, apart from its
 * main source), a low-passed one plays B itself from `bStart`. B opens on its pickup (a 4 ms declick), or with
 * D14's tape landing it powers up from `bStart` (inside the gap): −12 dB and low-passed at 800 Hz while its rate
 * climbs (the planner starts B with that rate ramp, P5), fully open on the pickup. The tape never follows a
 * low-passed Tease (the planner checks).
 * @param boost  added to the impact's level (D2's crowd gap lands bigger)
 */
export function landB({ T, pickupAt, gapStart, bStart, teaseFrom, tease, teaseStems, gB, phase, landing = null }: LandingArgs, boost = 0): PlanEvent[] {
  const events: PlanEvent[] = [];
  const from = teaseFrom ?? bStart;
  const stemTease = tease && Boolean(teaseStems?.includes('drums')) && gapStart - from > gB.beat;
  if (stemTease) {
    const span = gapStart - from;
    const parts: StemParts = { drums: { from: SILENT, to: 0.9, t0: from, t1: from + Math.min(gB.bar, span / 2) } };
    if (teaseStems?.includes('bass') && span >= 1.5 * gB.bar) {
      const t0 = gapStart - gB.bar;
      parts.bass = { from: SILENT, to: 0.8, t0, t1: t0 + gB.beat };
    }
    events.push({ kind: 'stems', deck: 'B', at: from, until: gapStart, parts });
  } else if (tease) {
    events.push(set('B.lpf', bStart, 380));
    events.push(ramp('B.gain', bStart, bStart + gB.bar / 2, SILENT, 0.3, 'lin'));
    events.push(ramp('B.lpf', bStart + gB.bar / 2, gapStart, 380, 1400, 'exp'));
    events.push(ramp('B.gain', gapStart - 0.01, gapStart, 0.3, SILENT, 'lin'));
    events.push(set('B.lpf', pickupAt - 0.002, OPEN_LPF));
    events.push(ramp('B.gain', pickupAt - 0.003, pickupAt, SILENT, 1, 'lin'));
  }
  if (landing?.style === 'tape') {
    const cfg = MOVES.tape;
    const growl = dbToGain(cfg.fromDb);
    events.push(
      ramp('B.gain', bStart, bStart + cfg.fadeInSec, SILENT, growl, 'lin'),
      ramp('B.gain', bStart + cfg.fadeInSec, pickupAt, growl, 1, 'exp'),
      ramp('B.lpf', bStart, pickupAt, cfg.lpfFromHz, OPEN_LPF, 'exp'),
    );
  } else if (stemTease) {
    events.push(set('B.gain', bStart, SILENT));
    events.push(ramp('B.gain', pickupAt - 0.003, pickupAt, SILENT, 1, 'lin'));
  } else if (!tease) {
    events.push(ramp('B.gain', bStart, pickupAt, SILENT, 1, 'lin'));
  }
  events.push(...impactLayer({ T, phase, landing, boost }));
  return events;
}

// ------------------------------------------------------------------------------------------ recipes
/** Where B's stretched layer starts (ctx time), the file time playing then, how many bars, and whether B's bass layers too. */
export interface BlendLayer {
  at: number;
  fileAt: number;
  bars: number;
  bass: boolean;
}

/** Variants forced by a test or the audition page (never by the show): R7's bridge, a recipe's variant kind. */
export interface VariantForce {
  bridge?: BridgePattern | null;
  variant?: string | null;
}

/** What may be layered or used besides A and B themselves; recipes that need more say so (`needs`). */
export interface Caps {
  /** B's render stretched to A's tempo for this hook (R8, D10, D16). */
  blend: boolean;
  /** A's stem lanes (P1), where they are valid; null when A has none here, or does not run at rate 1. */
  aLanes: LaneWindow | null;
  /** B's grain for a vocal chop or a scratch (D11, D19). */
  chop: ChopSource | null;
  /** B's stretched voice may sing over A (D16): rendered, tempos within ±4%, keys agreeing, B singing before its hook. */
  blendVocals: boolean;
}

export const NO_CAPS: Caps = { blend: false, aLanes: null, chop: null, blendVocals: false };

export interface BuildArgs {
  A: OutgoingDeck | null;
  i: number | null;
  e: number;
  T: number;
  pickupAt: number;
  gapStart: number;
  /** When B's own source starts (a declick before its lead, or its tape start). */
  bStart: number;
  /** Where a stem Tease starts, when it is not `bStart` (B powers up after it). */
  teaseFrom?: number;
  tease: boolean;
  teaseStems?: readonly StemName[] | null;
  gB: HookGrid;
  phase: PhaseEffects;
  rng: () => number;
  exit: ExitName | null;
  blend?: BlendLayer | null;
  /** The earliest time a move of A may start (after the spin-start duck); recipes shorten their moves to fit. */
  minStart?: number;
  /** A's stem lanes, where they are valid (P1). */
  aLanes?: LaneWindow | null;
  /** B's grain for D11's chops and D19's scratch. */
  chop?: ChopSource | null;
  /** D5: B's riff to loop under the bridge (R7), when the planner drew it. */
  riff?: RiffSource | null;
  /** The landing layer (plan/landing.ts); the classic cymbal when left out. */
  landing?: Landing | null;
  force?: VariantForce | null;
}

/** S1 recipes only run with A playing and one of its downbeats chosen (planner.ts guarantees both). */
export type S1BuildArgs = BuildArgs & { A: OutgoingDeck; i: number; minStart: number };

/** The variant a recipe drew, as the plan reports it (the HUD prints `kind`). */
export interface RecipeVariant {
  readonly kind: string;
  readonly [detail: string]: string | number | boolean;
}

export interface RecipeResult {
  events: PlanEvent[];
  aStopAt: number | null;
  variant?: RecipeVariant;
  /** The recipe plays B's call Signature itself: no other Signature of B is layered. */
  usesBSignature?: boolean;
  /** Layers the recipe played itself (D5's riff bed). */
  layers?: readonly LayerName[];
}

export interface Recipe {
  id: RecipeId;
  name: string;
  shape: RecipeShape;
  implemented: boolean;
  family: RecipeFamily;
  /** Two theatrical recipes never run back to back. */
  theatrical?: boolean;
  /** S2: the exit moves A may use, rotated. */
  exits?: readonly ExitName[];
  /** Seconds of A the move needs before `gapStart` (S1) or `e` (S2), at least. */
  aLeadSec: (tl: Timeline, i: number, exit?: ExitName | null, phase?: PhaseName) => number;
  build: (x: BuildArgs) => RecipeResult;
  /** What the recipe needs beyond A playing (B's render, A's stem lanes, B's vocals); always possible when left out. */
  needs?: (caps: Caps) => boolean;
  /** A's stem lanes it plays: its landings must lie inside them. */
  aLaneParts?: readonly LanePart[];
  /** The silence before B's pickup is at least this many of B's beats (when the pickup leaves room for a gap). */
  minGapBeats?: (phase: PhaseName) => number;
  /** Never drawn again within this many transitions. */
  cooldown?: number;
  /** A is cut low (or already gone) by the gap, so a pre-verb swell may overlap it. */
  aClearsLows?: boolean;
  /** A recipe the Ghost Tease (D9) may decorate: it leaves the reverb alone (S1, or an S2 bridge whose exit is not a wash). */
  ghostHost?: boolean;
  /** An S1 recipe that leaves its gap silent (nothing of A rings in it), so a one-beat chop or scratch may fill it. */
  gapHost?: boolean;
  /** An S2 recipe whose bridge may carry D5's riff bed. */
  riffHost?: boolean;
  /** S2: the bridge is at least this many of B's bars. */
  minBridgeBars?: number;
  /** S2: never Teased by B's stems or a low-passed B (D6's fake bar must not give B away). */
  noTease?: boolean;
  /** S1 and S3: whether the move suits A's bars before downbeat `i` (D15 needs A singing there). */
  fits?: (A: OutgoingDeck, i: number) => boolean;
}

/**
 * The args of an S1 or S3 recipe, which only runs with A playing and one of its downbeats chosen
 * (planner.ts guarantees both). `minStart` defaults to no limit.
 */
function riding(x: BuildArgs): S1BuildArgs {
  const { A, i } = x;
  if (!A || i == null) throw new Error('an S1 or S3 recipe needs A playing and an A downbeat');
  return { ...x, A, i, minStart: x.minStart ?? -Infinity };
}

/** The forced variant when it is one of `kinds`. */
function forced<K extends string>(x: BuildArgs, kinds: readonly K[]): K | null {
  return kinds.find((k) => k === x.force?.variant) ?? null;
}

/** True when the lane window has every part. */
export function lanesHave(lanes: LaneWindow | null | undefined, parts: readonly LanePart[]): lanes is LaneWindow {
  return Boolean(lanes) && parts.every((p) => lanes?.parts.includes(p));
}

const R7_EXITS: readonly ExitName[] = ['echo', 'roll', 'brake', 'spinback', 'wash', 'gate', 'spiral'];
const ALL_PARTS: readonly LanePart[] = ['drums', 'bass', 'vocals', 'other'];
const riserLoud = (phase: PhaseEffects, base: Readonly<Record<PhaseName, number>>): number => base[phase.name] ?? -10;

/** A's exit before an S2 bridge (R7, D11), when A is playing. */
function s2Exit(x: BuildArgs): { events: PlanEvent[]; aStopAt: number | null } {
  const { A, i, e, rng, exit, phase } = x;
  if (!A) return { events: [], aStopAt: null };
  // With A playing, the planner always passes A's exit downbeat and an exit drawn from `exits`.
  if (i == null || !exit) throw new Error('an S2 recipe needs A\'s exit downbeat and an exit move');
  const variant = exit === 'gate' || exit === 'spiral' ? x.force?.variant ?? null : null;
  return EXITS[exit].build({ A, i, end: e, rng, bars: 1, tailBeats: 2, phase: phase.name, variant });
}

const R1_KINDS = ['hpf', 'lpf', 'stab'] as const;
const R2_KINDS = ['echo', 'freeze', 'vocalThrow'] as const;
const R5_KINDS = ['spinback', 'brake'] as const;
const D10_EXITS = ['echo', 'wash', 'throw'] as const;
const D6_KINDS = ['drums', 'comedy', 'kicks'] as const;
const D7_KINDS = ['plain', 'gate'] as const;
const D16_EXITS = ['echo', 'wash'] as const;

/** An S2 recipe's exit lead: the exit the planner drew from `exits` (never null for these). */
const exitLead = (id: RecipeId) => (tl: Timeline, i: number, exit?: ExitName | null): number => {
  if (!exit) throw new Error(`${id} needs an exit move`);
  return EXITS[exit].lead(tl, i);
};

export const RECIPES: Record<RecipeId, Recipe> = {
  // R1 · Slam cut: A's high-pass (or a low-pass dive, the door closing) and a riser climb over its last bar,
  // swell, cut, impact on the one; or a single stop-time stab on A's last beat before the cut.
  R1: {
    id: 'R1',
    name: 'Slam cut',
    shape: 'S1',
    implemented: true,
    family: 'cut',
    aClearsLows: true,
    ghostHost: true,
    gapHost: true,
    aLeadSec: (tl, i) => tl.barAt(i),
    build(x) {
      const { A, i, T, gapStart, gB, rng, landing } = riding(x);
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      let kind = forced(x, R1_KINDS) ?? weightedPick(MOVES.variants.R1, rng) ?? 'hpf';
      const events: PlanEvent[] = [];
      const hold = 0.25 * beatA;
      const stabAt = aGrid(A, i, T, gapStart - hold - 0.04).end;
      if (kind === 'stab' && stabAt - 0.06 < gapStart - barA) kind = 'hpf';
      if (kind === 'lpf') events.push(ramp('A.lpf', gapStart - barA, gapStart, OPEN_LPF, 250, 'exp'));
      else events.push(ramp('A.hpf', gapStart - barA, gapStart, 20, 600, 'exp'));
      if (kind === 'stab') {
        // A breath of silence, one hit on A's last beat, silence into the gap.
        events.push(
          ramp('A.gain', stabAt - 0.05, stabAt - 0.02, A.level, SILENT, 'lin'),
          ramp('A.gain', stabAt, stabAt + 0.003, SILENT, A.level, 'lin'),
          ramp('A.gain', stabAt + 0.003 + hold, stabAt + 0.033 + hold, A.level, SILENT, 'lin'),
          synth('kicks', { times: [stabAt], level: MOVES.hits.kick }),
          sfx('thunk', stabAt, MOVES.hits.thunkDb),
        );
      } else events.push(ramp('A.gain', gapStart - 0.01, gapStart, A.level, SILENT, 'lin'));
      events.push(
        synth('riser', { t0: gapStart - barA, t1: gapStart, fromHz: 900, toHz: 9000, fromDb: -36, toDb: -10, tone: false }),
        ...swellLayer(landing, gapStart - Math.min(barA, 2 * gB.beat), gapStart, -10),
        ...landB(x),
      );
      return { events, aStopAt: gapStart + 0.05, variant: { kind } };
    },
  },

  // R2 · Echo-out with a filter sweep and riser into the hook. Variants: the delay (½, ¾ or 1 beat), an echo
  // freeze (A's last beat caught at feedback 0.92, A cut, the frozen loop rings to the gap), and — with A's
  // stem lanes — a vocal-only throw while A's band plays on to the gap.
  R2: {
    id: 'R2',
    name: 'Echo-out',
    shape: 'S1',
    implemented: true,
    family: 'echo',
    aClearsLows: true,
    ghostHost: true,
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i), // the riser starts a full bar of A before the gap
    build(x) {
      const { A, i, T, gapStart, pickupAt, gB, rng, aLanes, landing } = riding(x);
      const cfg = MOVES.variants.R2;
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      const delayBeats = pick(cfg.delayBeats, rng);
      const canThrow = lanesHave(aLanes, ['vocals']) && aLanes.from <= gapStart - 2 * beatA && aLanes.to >= gapStart + 0.1;
      let kind = forced(x, R2_KINDS) ?? (canThrow && rng() < cfg.vocalThrow ? 'vocalThrow' : rng() < cfg.freeze ? 'freeze' : 'echo');
      if (kind === 'vocalThrow' && !canThrow) kind = 'echo';
      const events: PlanEvent[] = [];
      let aStopAt = gapStart + 0.05;
      if (kind === 'echo') {
        const exit = EXITS.echo.build({ A, i, end: gapStart, rng, tailBeats: 1, delayBeats });
        events.push(...exit.events);
        aStopAt = exit.aStopAt;
      } else if (kind === 'freeze') {
        // Catch A's last beat, freeze it, cut A: the loop is the bed under the riser.
        const { end } = aGrid(A, i, T, gapStart);
        const catchAt = end - beatA;
        const delay = (delayBeats >= 0.75 ? 1 : 0.5) * beatA;
        const cutAt = catchAt + beatA / 2;
        events.push(
          set('echo.time', catchAt - beatA, delay),
          set('echo.feedback', catchAt - beatA, 0.5),
          set('echo.hpf', catchAt - beatA, 250),
          set('echo.return', catchAt - beatA, 1),
          ramp('A.echoSend', catchAt - beatA / 2, catchAt, 0, 0.7, 'lin'),
          set('echo.feedback', catchAt, cfg.freezeFeedback),
          ramp('A.hpf', catchAt - barA + beatA, cutAt, 20, 400, 'exp'),
          ramp('A.gain', cutAt - 0.01, cutAt, A.level, SILENT, 'lin'),
          set('A.echoSend', cutAt, 0),
          ramp('echo.hpf', cutAt, gapStart, 250, 1400, 'exp'),
          ramp('echo.return', gapStart, gapStart + 0.005, 1, SILENT, 'lin'),
          set('echo.feedback', gapStart + 0.01, 0),
          set('echo.return', pickupAt + 0.3, 1),
        );
        aStopAt = cutAt + 0.05;
      } else {
        // Only A's voice goes into the echo; its band plays on, high-passing, to the gap.
        const { end } = aGrid(A, i, T, gapStart);
        events.push(
          ...vocalThrow({ throwAt: end - beatA, end: gapStart, beatA, pickupAt, beatB: gB.beat, rng }),
          ramp('A.hpf', gapStart - barA, gapStart, 20, 450, 'exp'),
          ramp('A.gain', gapStart - 0.01, gapStart, A.level, SILENT, 'lin'),
        );
      }
      events.push(
        synth('riser', { t0: gapStart - barA, t1: gapStart, fromHz: 800, toHz: 8000, fromDb: -36, toDb: -11, tone: false }),
        ...swellLayer(landing, gapStart - Math.min(barA, 2 * gB.beat), gapStart, -11),
        ...landB(x),
      );
      return { events, aStopAt, variant: { kind, delayBeats } };
    },
  },

  // R4 · Loop roll: A stutters faster and faster, then the hook lands. Variants: the slice (the bar's first
  // or last beat), a triplet ladder, and slices pitching up.
  R4: {
    id: 'R4',
    name: 'Loop roll',
    shape: 'S1',
    implemented: true,
    family: 'roll',
    theatrical: true,
    aClearsLows: true,
    ghostHost: true,
    gapHost: true,
    aLeadSec: (tl, i) => 2 * tl.barAt(i),
    build(x) {
      const { A, i, gapStart, phase, rng } = riding(x);
      const cfg = MOVES.variants.R4;
      const bars = phase.name === 'early' || A.tl.barAt(i) > 2.4 ? 1 : 2;
      const lastBeat = x.force?.variant === 'lastBeat' || rng() < cfg.lastBeat;
      const triplet = x.force?.variant === 'triplet' || rng() < cfg.triplet;
      const rateTo = x.force?.variant === 'pitchUp' || rng() < cfg.pitchUp[phase.name] ? cfg.pitchTo : 1;
      const exit = EXITS.roll.build({ A, i, end: gapStart, bars, lastBeat, triplet, rateTo });
      const rollStart = gapStart - bars * A.tl.barAt(i);
      const events = [
        ...exit.events,
        synth('riser', { t0: rollStart, t1: gapStart, fromHz: 1000, toHz: 10000, fromDb: -34, toDb: -10, tone: true }),
        ...landB(x),
      ];
      return { events, aStopAt: exit.aStopAt, variant: { kind: triplet ? 'triplet' : 'straight', bars, lastBeat, pitchUp: rateTo !== 1 } };
    },
  },

  // R5 · Brake or spinback, a breath of silence, then the hook. The brake's length and the rewind's speed vary.
  R5: {
    id: 'R5',
    name: 'Brake / spinback',
    shape: 'S1',
    implemented: true,
    family: 'stop',
    theatrical: true,
    ghostHost: true,
    gapHost: true,
    aLeadSec: () => 1.3,
    build(x) {
      const { A, gapStart, rng, landing } = riding(x);
      const cfg = MOVES.variants.R5;
      const kind = forced(x, R5_KINDS) ?? (rng() < 0.5 ? 'spinback' : 'brake');
      let exit: ExitResult;
      if (kind === 'brake') exit = EXITS.brake.build({ A, end: gapStart, dur: pick(cfg.brakeSec, rng) });
      else {
        const dur = pick(cfg.spinSec, rng);
        const rateFrom = pick(cfg.spinRate, rng);
        const start = gapStart - dur;
        exit = {
          aStopAt: start + 0.005,
          events: [
            set('A.gain', start, 1),
            { kind: 'spinback', deck: 'A', at: start, fromPos: A.tl.posAt(start), seconds: 1.6, rateFrom, dur },
            ramp('A.hpf', start, gapStart, 20, 250, 'exp'),
            set('A.gain', gapStart + 0.02, SILENT),
          ],
        };
      }
      const events = [...exit.events, ...swellLayer(landing, gapStart - 0.6, gapStart, -12), ...landB(x)];
      return { events, aStopAt: exit.aStopAt, variant: { kind } };
    },
  },

  // R6 · Reverb wash: A dissolves, the hook comes out of the cloud.
  R6: {
    id: 'R6',
    name: 'Reverb wash',
    shape: 'S1',
    implemented: true,
    family: 'wash',
    aLeadSec: EXITS.wash.lead,
    build(x) {
      const { A, i, gapStart, T, gB, landing } = riding(x);
      const exit = EXITS.wash.build({ A, i, end: gapStart });
      const events = [
        ...exit.events,
        ...swellLayer(landing, gapStart - A.tl.barAt(i), gapStart, -9),
        ramp('reverb.return', T, T + 2 * gB.beat, 1, SILENT, 'lin'),
        set('reverb.return', T + 2 * gB.beat + 0.05, 1),
        set('A.reverbSend', T + 0.01, 0),
        ...landB(x),
      ];
      return { events, aStopAt: exit.aStopAt };
    },
  },

  // R7 · Build: A exits (echo / roll / brake / spinback / wash / gate / spiral), then N bars of a build on B's
  // grid (a bridge pattern drawn apart from the exit: the roll, half-time, a kick roll or a clap-along), a
  // Tease of B (sometimes D5's riff bed: B's riff looping under the build), a beat of silence, and the landing.
  R7: {
    id: 'R7',
    name: 'Build & land',
    shape: 'S2',
    implemented: true,
    family: 'build',
    exits: R7_EXITS,
    ghostHost: true,
    riffHost: true,
    aLeadSec: (tl, i, exit) => {
      // The planner passes the exit it drew from `exits`, so it is never null here.
      if (!exit) throw new Error('R7 needs an exit move');
      return EXITS[exit].lead(tl, i);
    },
    build(x): RecipeResult {
      const { e, T, gapStart, pickupAt, gB, phase, rng, landing, riff } = x;
      const out = s2Exit(x);
      const pattern = chooseBridge(phase, (gapStart - e) / gB.bar, rng, x.force?.bridge ?? null);
      const bed = riff ? riffBed({ riff, e, T, gapStart, pickupAt, gB, phase: phase.name, signatureDb: phase.signatureDb, rng, variant: forced(x, RIFF_VARIANTS) }) : null;
      const rollScale = bed ? MOVES.riff.rollScale : 1;
      const events = [...out.events, ...bridgeLayers({ pattern, t0: e, gapStart, pickupAt, gB, phase, rng, landing, rollScale }), ...(bed?.events ?? []), ...landB(x)];
      if (!bed) return { events, aStopAt: out.aStopAt, variant: { kind: pattern } };
      return { events, aStopAt: out.aStopAt, variant: { kind: pattern, riff: bed.variant }, usesBSignature: true, layers: ['riff'] };
    },
  },

  // R10 · Power-down suspense (final phase, round opener): tape stop, heartbeat on B's beats, then the
  // build, a long silence, and the biggest impact.
  R10: {
    id: 'R10',
    name: 'Power-down',
    shape: 'S2',
    implemented: true,
    family: 'powerdown',
    theatrical: true,
    ghostHost: true,
    exits: ['brake'],
    aLeadSec: () => 1.6,
    build(x) {
      const { A, e, gapStart, pickupAt, gB, phase, landing } = x;
      const events: PlanEvent[] = [];
      let aStopAt: number | null = null;
      if (A) {
        const out = EXITS.brake.build({ A, end: e, dur: 1.5 });
        events.push(...out.events);
        aStopAt = out.aStopAt;
      }
      // Heartbeat for the first part of the bridge, then the build.
      const span = gapStart - e;
      const heartEnd = e + Math.min(gB.bar, Math.max(0, span - gB.bar));
      const times: number[] = [];
      for (let t = e; t < heartEnd - 1e-6; t += gB.beat) times.push(t, t + gB.beat * 0.28);
      if (times.length) events.push(synth('kicks', { times, level: 0.45 }));
      events.push(...buildLayers({ t0: heartEnd, gapStart, pickupAt, gB, phase, landing }));
      events.push(...landB(x));
      return { events, aStopAt };
    },
  },

  // R8 · Blend: B's own groove, stretched to A's tempo and locked to A's downbeats, comes in under A —
  // its drums first, then (tempos within ±4%, compatible keys) its bass while A's bass is cut. A echoes
  // or washes out under a riser and a swell, and B lands on its hook at its own tempo with an impact.
  R8: {
    id: 'R8',
    name: 'Blend',
    shape: 'S3',
    implemented: true,
    family: 'blend',
    needs: (caps) => caps.blend,
    aLeadSec: (tl, i) => 2 * tl.barAt(i), // the planner places the layer itself (blendStart)
    build(x) {
      const { A, i, T, gapStart, pickupAt, bStart, phase, rng, blend, landing } = riding(x);
      if (!blend) throw new Error('R8 needs a blend layer');
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      const parts: StemParts = { drums: { from: SILENT, to: 0.9, t0: blend.at, t1: Math.min(blend.at + barA, pickupAt) } };
      const bassAt = T - barA;
      if (blend.bass && bassAt >= blend.at + barA - 1e-6) parts.bass = { from: SILENT, to: 0.85, t0: bassAt, t1: bassAt + beatA };
      const events: PlanEvent[] = [{ kind: 'blend', deck: 'B', at: blend.at, until: pickupAt, fileAt: blend.fileAt, parts }];
      // A thins out as B's groove comes in; with B's bass, A's bass goes (the bass swap).
      if (parts.bass) events.push(ramp('A.hpf', bassAt, bassAt + beatA, 20, 260, 'exp'));
      else events.push(ramp('A.hpf', Math.max(blend.at, T - barA), gapStart, 20, 180, 'exp'));
      // A leaves over its last beats.
      const kind = rng() < 0.6 ? 'echo' : 'wash';
      const out = EXITS[kind].build({ A, i, end: gapStart, rng, tailBeats: 1 });
      events.push(...out.events);
      const loud = riserLoud(phase, { early: -12, mid: -10, late: -8, final: -6 });
      events.push(synth('riser', { t0: Math.max(blend.at, T - 2 * barA), t1: gapStart, fromHz: 800, toHz: 9000, fromDb: loud - 24, toDb: loud, tone: false }));
      events.push(...swellLayer(landing, gapStart - Math.min(barA, 2 * beatA), gapStart, loud - 1));
      // B's own mix takes over from the stretched layer on the pickup, then the impact.
      events.push(set('B.gain', bStart, SILENT));
      events.push(ramp('B.gain', pickupAt - LAYERING.handoverSec, pickupAt, SILENT, 1, 'lin'));
      events.push(...impactLayer({ T, phase, landing }));
      return { events, aStopAt: out.aStopAt, variant: { kind, bars: blend.bars, bass: Boolean(parts.bass) } };
    },
  },

  // D1 · Trans gate and pump: A chopped on its own grid with a ladder that speeds up to 1/32 (a partial gate
  // early, full late), or pumped like a sidechain on every beat with kicks, or both; its high-pass climbs, a
  // riser, then the hook. Final adds the music bus's high-pass over the last bar.
  D1: {
    id: 'D1',
    name: 'Trans gate',
    shape: 'S1',
    implemented: true,
    family: 'gate',
    ghostHost: true,
    gapHost: true,
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, phase, rng, minStart, landing } = riding(x);
      const { barA, beatA, end } = aGrid(A, i, T, gapStart);
      const bars = fitBars(MOVES.gate.bars[phase.name], end, barA, minStart);
      const gate = gateMove({ A, i, end, bars, phase: phase.name, rng, mode: forced(x, GATE_MODES) });
      const loud = MOVES.gate.riserDb[phase.name];
      const events: PlanEvent[] = [
        ...gate.events,
        synth('riser', { t0: gate.start, t1: end, fromHz: 800, toHz: 9000, fromDb: -36, toDb: loud, tone: false }),
        ...swellLayer(landing, Math.max(gate.start, end - 2 * beatA), end, loud - 2),
      ];
      if (phase.name === 'final') events.push(ramp('bus.hpf', end - barA, end, 10, MOVES.gate.finalBusHpfHz, 'exp'), set('bus.hpf', pickupAt - 0.002, 10));
      events.push(...landB(x));
      return { events, aStopAt: end + 0.05, variant: { kind: gate.mode, bars } };
    },
  },

  // D2 · Stop-time hits and the crowd gap: A only on chosen beats ("pam · pam · pam ·"), silence between for
  // the room to shout, the last hit ringing out, a gap of at least a beat, and a bigger impact.
  D2: {
    id: 'D2',
    name: 'Stop-time hits',
    shape: 'S1',
    implemented: true,
    family: 'hits',
    theatrical: true,
    cooldown: MOVES.hits.cooldown,
    minGapBeats: (phase) => MOVES.hits.minGapBeats[phase],
    aLeadSec: (tl, i, _exit, phase) => (phase === 'late' || phase === 'final' ? 2 : 1) * tl.barAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, phase, rng, minStart } = riding(x);
      const hits = stabsMove({ A, i, T, gapStart, pickupAt, minStart, phase: phase.name, rng });
      return { events: [...hits.events, ...landB(x, MOVES.hits.impactBoost)], aStopAt: hits.aStopAt, variant: { kind: 'stops', stabs: hits.stabs.length } };
    },
  },

  // D3 · Spiral echo-out: A's last beats caught in an echo whose delay shrinks, so the repeats climb in pitch
  // into a swirl, A's dry signal gone, the swirl cut dead before the hook.
  D3: {
    id: 'D3',
    name: 'Spiral echo-out',
    shape: 'S1',
    implemented: true,
    family: 'spiral',
    aClearsLows: true,
    ghostHost: true,
    gapHost: true,
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, phase, rng, minStart, landing } = riding(x);
      const { barA, beatA, end } = aGrid(A, i, T, gapStart);
      const bars = fitBars(MOVES.spiral.bars[phase.name], end, barA, minStart);
      const spiral = spiralMove({ A, i, end, bars, phase: phase.name, rng, restoreAt: pickupAt + 0.3 });
      const events = [...spiral.events, ...swellLayer(landing, end - 2 * beatA, end, -11), ...landB(x)];
      return { events, aStopAt: end + 0.05, variant: { kind: 'up', bars } };
    },
  },

  // D8 · Stem peel: A's drums, bass and the rest removed one by one (stem lanes, P1) until its singer is left,
  // under a riser; the voice is thrown into the echo on the last beat, then silence and the full hook.
  D8: {
    id: 'D8',
    name: 'Stem peel',
    shape: 'S1',
    implemented: true,
    family: 'strip',
    needs: (caps) => lanesHave(caps.aLanes, ALL_PARTS),
    aLaneParts: ALL_PARTS,
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, gB, phase, rng, minStart, aLanes, landing } = riding(x);
      if (!aLanes) throw new Error('D8 needs A\'s stem lanes');
      const { barA, beatA, end } = aGrid(A, i, T, gapStart);
      const bars = fitBars(pick(MOVES.peel.bars[phase.name], rng), end, barA, Math.max(minStart, aLanes.from));
      const peel = peelMove({ A, i, end, bars, T, pickupAt, beatB: gB.beat, phase: phase.name, rng, order: forced(x, PEEL_ORDERS) });
      const loud = riserLoud(phase, { early: -12, mid: -10, late: -8, final: -6 });
      const events = [
        ...peel.events,
        synth('riser', { t0: peel.start, t1: end, fromHz: 700, toHz: 9000, fromDb: loud - 24, toDb: loud, tone: false }),
        ...swellLayer(landing, end - 2 * beatA, end, loud - 2),
        ...landB(x),
      ];
      return { events, aStopAt: peel.aStopAt, variant: { kind: peel.order, bars } };
    },
  },

  // D10 · Drum swap: on one of A's downbeats its own drums vanish (a stem lane) and B's drums, stretched to A's
  // tempo, take their place under A's voice — never two kits at once; sometimes juggled back and forth. Tight
  // pairs with compatible keys swap the bass in the last bar too. A (drumless) leaves by echo, wash or a vocal
  // throw, and B lands at its own tempo.
  D10: {
    id: 'D10',
    name: 'Drum swap',
    shape: 'S3',
    implemented: true,
    family: 'swap',
    needs: (caps) => caps.blend && lanesHave(caps.aLanes, ['drums']),
    aLaneParts: ['drums'],
    aLeadSec: (tl, i) => 2 * tl.barAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, bStart, gB, phase, rng, blend, aLanes, minStart, landing } = riding(x);
      if (!blend || !aLanes) throw new Error('D10 needs a blend layer and A\'s stem lanes');
      const cfg = MOVES.swap;
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      // The swap's downbeat: n of A's bars before T, inside the layer and the lanes, after the duck.
      const floor = Math.max(blend.at, aLanes.from, minStart);
      const downs = A.tl.downbeatsBetween(floor - 1e-6, T - barA + 1e-6).filter((d) => d.index < i);
      const want = pick(cfg.bars[phase.name], rng);
      const swapAt = downs.find((d) => d.index === i - want) ?? downs[0];
      if (!swapAt) throw new Error('D10: no downbeat to swap on (the planner checks the lanes and the layer)');
      const L = swapAt.ctxTime;
      const n = i - swapAt.index;
      const juggle = x.force?.variant === 'juggle' || (n >= 2 && rng() < cfg.juggle);
      const cutIn = rng() < 0.5 ? 0.005 : beatA;
      const bassAt = T - barA;
      const bass = blend.bass && lanesHave(aLanes, ['bass']) && bassAt >= L + (juggle ? 4 * beatA : 0) - 1e-6;
      const fileAt = (t: number) => blend.fileAt + (t - blend.at);
      const drums = (t0: number) => ({ from: SILENT, to: cfg.drums, t0, t1: t0 + cutIn });
      const aStop = gapStart + 0.05;
      const events: PlanEvent[] = [];
      // A's drums out, B's in (juggled: two beats out, two back, then for good).
      const out: [number, number][] = juggle
        ? [[L, 0], [L + 0.01, -1], [L + 2 * beatA, -1], [L + 2 * beatA + 0.01, 0], [L + 4 * beatA, 0], [L + 4 * beatA + 0.01, -1]]
        : [[L, 0], [L + 0.01, -1]];
      events.push({ kind: 'stemLane', deck: 'A', part: 'drums', at: L, until: aStop, direct: out });
      const lastLayerAt = juggle ? L + 4 * beatA : L;
      const layer = (at: number, until: number, withBass: boolean): BlendEvent => {
        const parts: StemParts = { drums: drums(at) };
        if (withBass) parts.bass = { from: SILENT, to: cfg.bass, t0: bassAt, t1: bassAt + beatA };
        return { kind: 'blend', deck: 'B', at, until, fileAt: fileAt(at), parts };
      };
      if (juggle) events.push(layer(L, L + 2 * beatA, false));
      events.push(layer(lastLayerAt, pickupAt, bass));
      // B's kick against A's bassline: A's bass a little down, or A high-passed; with the bass swap, A's bass goes.
      const bassDown = lanesHave(aLanes, ['bass']) && rng() < 0.5;
      if (bassDown || bass) {
        const points: [number, number][] = bassDown ? [[L, 0], [L + 0.01, cfg.aBassDown]] : [[L, 0]];
        if (bass) points.push([bassAt, bassDown ? cfg.aBassDown : 0], [bassAt + beatA, -1]);
        events.push({ kind: 'stemLane', deck: 'A', part: 'bass', at: L, until: aStop, direct: points });
      }
      if (!bassDown) events.push(ramp('A.hpf', L, L + 0.05, 20, cfg.aHpfHz, 'exp'));
      // A leaves over its last beats.
      const canThrow = lanesHave(aLanes, ['vocals']);
      let kind = forced(x, D10_EXITS) ?? weightedPick(canThrow ? cfg.exits : { ...cfg.exits, throw: 0 }, rng) ?? 'echo';
      if (kind === 'throw' && !canThrow) kind = 'echo';
      let aStopAt = aStop;
      if (kind === 'throw') {
        const { end } = aGrid(A, i, T, gapStart);
        events.push(
          ...vocalThrow({ throwAt: end - beatA, end: gapStart, beatA, pickupAt, beatB: gB.beat, rng }),
          ramp('A.hpf', gapStart - barA, gapStart, cfg.aHpfHz, 450, 'exp'),
          ramp('A.gain', gapStart - 0.01, gapStart, A.level, SILENT, 'lin'),
        );
      } else {
        const exit = EXITS[kind].build({ A, i, end: gapStart, rng, tailBeats: 1 });
        events.push(...exit.events);
        aStopAt = exit.aStopAt;
      }
      const loud = riserLoud(phase, { early: -12, mid: -10, late: -8, final: -6 });
      events.push(synth('riser', { t0: Math.max(L, T - 2 * barA), t1: gapStart, fromHz: 800, toHz: 9000, fromDb: loud - 24, toDb: loud, tone: false }));
      events.push(...swellLayer(landing, gapStart - Math.min(barA, 2 * beatA), gapStart, loud - 1));
      events.push(set('B.gain', bStart, SILENT));
      events.push(ramp('B.gain', pickupAt - LAYERING.handoverSec, pickupAt, SILENT, 1, 'lin'));
      events.push(...impactLayer({ T, phase, landing }));
      return { events, aStopAt, variant: { kind, bars: n, juggle, bass } };
    },
  },

  // D11 · Vocal-chop stutter build: A exits as in R7, the build runs on B's grid (its roll down under the
  // chops), and B's first syllable — from its approved call or its vocal stem — is chopped faster and faster
  // over the last bars ("ca-ca-ca-CARAMEL"), then the gap and the full word on the pickup.
  D11: {
    id: 'D11',
    name: 'Vocal-chop build',
    shape: 'S2',
    implemented: true,
    family: 'chop',
    exits: R7_EXITS,
    needs: (caps) => caps.chop != null,
    minGapBeats: (phase) => MOVES.chop.minGapBeats[phase],
    aLeadSec: (tl, i, exit) => {
      if (!exit) throw new Error('D11 needs an exit move');
      return EXITS[exit].lead(tl, i);
    },
    build(x) {
      const { e, gapStart, pickupAt, gB, phase, rng, chop, landing } = x;
      if (!chop) throw new Error('D11 needs a grain to chop');
      const out = s2Exit(x);
      const events = [...out.events, ...buildLayers({ t0: e, gapStart, pickupAt, gB, phase, rng, landing, rollScale: MOVES.chop.rollScale })];
      const bars = Math.max(1, Math.min(MOVES.chop.bars[phase.name], Math.floor((gapStart - e) / gB.bar + 1e-6)));
      const slices = chopSlices({ source: chop, gapStart, gB, bars, from: e, phase: phase.name, signatureDb: phase.signatureDb, rng });
      if (slices) events.push(slices);
      events.push(...landB(x));
      return { events, aStopAt: out.aStopAt, variant: { kind: chop.from, bars: slices ? bars : 0 }, usesBSignature: Boolean(slices) && chop.from === 'signature' };
    },
  },

  // D6 · Fake drop (the overshooter): A exits as in R7, a build peaks, a beat of silence where everyone expects
  // the hook, then a bar of something else (B's drums alone, a comedy sample, or heartbeat kicks) with a small
  // hit, a short faster re-build with the music bus high-passing, the gap, and the real landing, bigger.
  D6: {
    id: 'D6',
    name: 'Fake drop',
    shape: 'S2',
    implemented: true,
    family: 'fake',
    theatrical: true,
    exits: R7_EXITS,
    cooldown: MOVES.fake.cooldown,
    minBridgeBars: MOVES.fake.minBridgeBars,
    noTease: true,
    aLeadSec: exitLead('D6'),
    build(x) {
      const { e, T, gapStart, pickupAt, gB, phase, rng, landing, teaseStems } = x;
      const cfg = MOVES.fake;
      const out = s2Exit(x);
      // On B's grid: the fake bar two bars before the hook, a beat of silence before it, the re-build after it.
      const fakeAt = T - 2 * gB.bar;
      const firstEnd = fakeAt - gB.beat;
      const rebuildAt = fakeAt + gB.bar;
      if (firstEnd - e < 0.3 || gapStart - rebuildAt < gB.beat / 2) {
        // Never with the planner's minimum bridge; a plain build if it happens.
        return { events: [...out.events, ...buildLayers({ t0: e, gapStart, pickupAt, gB, phase, rng, landing }), ...landB(x)], aStopAt: out.aStopAt, variant: { kind: 'short' } };
      }
      const canDrums = Boolean(teaseStems?.includes('drums'));
      let kind = forced(x, D6_KINDS) ?? weightedPick(canDrums ? cfg.kinds : { ...cfg.kinds, drums: 0 }, rng) ?? 'comedy';
      if (kind === 'drums' && !canDrums) kind = 'comedy';
      const loud = riserLoud(phase, { early: -12, mid: -9, late: -7, final: -5 });
      const events: PlanEvent[] = [
        ...out.events,
        // The first build: it peaks into a silence, with the same landing layer the real one will have.
        ...buildLayers({ t0: e, gapStart: firstEnd, pickupAt: fakeAt, gB, phase, rng, landing }),
        // The fake bar.
        synth('impact', { at: fakeAt, level: cfg.impact }),
      ];
      const beats = Array.from({ length: gB.bpb }, (_, k) => fakeAt + k * gB.beat);
      if (kind === 'drums') {
        events.push({ kind: 'stems', deck: 'B', at: fakeAt, until: rebuildAt - 0.02, parts: { drums: { from: SILENT, to: 0.9, t0: fakeAt, t1: fakeAt + 0.005 } } });
      } else if (kind === 'comedy') {
        events.push(sfx(pick(cfg.comedy, rng), fakeAt, cfg.comedyDb), synth('kicks', { times: beats.filter((_, k) => k % 2 === 0), level: cfg.kick }));
      } else {
        events.push(synth('kicks', { times: beats.flatMap((t) => [t, t + 0.28 * gB.beat]), level: cfg.kick }), synth('downlifter', { t0: fakeAt, t1: rebuildAt, peakDb: -18 }));
      }
      // The re-build: faster and higher, the bus high-passing, into the real gap.
      events.push(
        synth('snareRoll', { t0: rebuildAt, t1: gapStart, beat: gB.beat, pitchTo: (phase.snarePitch ?? 5) + 2, stages: [0.25, 0.125], velFrom: 70, velTo: 124 }),
        synth('riser', { t0: rebuildAt, t1: gapStart, fromHz: 1200, toHz: 10000, fromDb: -20, toDb: loud + 2, tone: true }),
        ramp('bus.hpf', rebuildAt, gapStart, 10, cfg.rebuildHpfHz, 'exp'),
        set('bus.hpf', pickupAt - 0.002, 10),
        ...swellLayer(landing, Math.max(rebuildAt, gapStart - 2 * gB.beat), gapStart, loud),
        ...landB(x, cfg.impactBoost),
      );
      return { events, aStopAt: out.aStopAt, variant: { kind } };
    },
  },

  // D7 · Pitch-up rush: A becomes the riser — its tape speed climbs (pitch and tempo together, at most +5
  // semitones), its high-pass opening, a breath of silence, the hook. Late, a gate may chop it on its rising beats.
  D7: {
    id: 'D7',
    name: 'Pitch-up rush',
    shape: 'S1',
    implemented: true,
    family: 'pitch',
    theatrical: true,
    ghostHost: true,
    gapHost: true,
    minGapBeats: (phase) => MOVES.rush.minGapBeats[phase],
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i),
    build(x) {
      const { A, i, T, gapStart, phase, rng, minStart, landing } = riding(x);
      const { barA, beatA, end } = aGrid(A, i, T, gapStart);
      const bars = fitBars(pick(MOVES.rush.bars[phase.name], rng), end, barA, minStart);
      const variant = forced(x, D7_KINDS);
      const rush = rushMove({ A, i, end, bars, phase: phase.name, rng, gate: variant ? variant === 'gate' : null });
      const events = [...rush.events, ...swellLayer(landing, Math.max(rush.start, end - 2 * beatA), end, MOVES.rush.riserDb[phase.name] - 2), ...landB(x)];
      return { events, aStopAt: end + 0.05, variant: { kind: rush.gated ? 'gate' : 'plain', bars, semitones: rush.semitones } };
    },
  },

  // D15 · Instrumental braker: A's band grinds to a halt over its last bar while its singer carries on, dry and
  // at speed; half a beat before the gap the voice is thrown into the echo, then B lands.
  D15: {
    id: 'D15',
    name: 'Instrumental braker',
    shape: 'S1',
    implemented: true,
    family: 'stop',
    theatrical: true,
    needs: (caps) => lanesHave(caps.aLanes, ['vocals']),
    aLaneParts: ['vocals'],
    fits: (A, i) => singsBefore(A, i, 2, MOVES.braker.minVocalsDb),
    aLeadSec: (tl, i) => tl.barAt(i) + tl.beatAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, gB, phase, rng, landing } = riding(x);
      const { barA, beatA, end } = aGrid(A, i, T, gapStart);
      const brake = brakerMove({ A, i, end, pickupAt, beatB: gB.beat, rng });
      const loud = MOVES.braker.riserDb[phase.name];
      const events = [
        ...brake.events,
        synth('riser', { t0: brake.start, t1: end, fromHz: 700, toHz: 8000, fromDb: loud - 22, toDb: loud, tone: false }),
        ...swellLayer(landing, end - 2 * beatA, end, loud - 2),
        ...landB(x),
      ];
      return { events, aStopAt: brake.aStopAt, variant: { kind: 'braker', brakeBars: Number((brake.brakeSec / barA).toFixed(2)) } };
    },
  },

  // D16 · Acapella-in mashup: on one of A's downbeats its singer drops out and B's pre-chorus voice, stretched to
  // A's tempo, sings over A's band (A a little down and high-passed to make room, its drums kept); A leaves by
  // echo or wash on its last beat and B's own chorus lands — a live mashup. Tight tempos and agreeing keys only.
  D16: {
    id: 'D16',
    name: 'Acapella-in mashup',
    shape: 'S3',
    implemented: true,
    family: 'swap',
    needs: (caps) => caps.blend && caps.blendVocals && lanesHave(caps.aLanes, ['vocals']),
    aLaneParts: ['vocals'],
    aLeadSec: (tl, i) => 2 * tl.barAt(i),
    build(x) {
      const { A, i, T, gapStart, pickupAt, bStart, phase, rng, blend, aLanes, minStart, landing } = riding(x);
      if (!blend || !aLanes) throw new Error('D16 needs a blend layer and A\'s stem lanes');
      const cfg = MOVES.acapella;
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      // The swap's downbeat: n of A's bars before T, inside the layer and the lanes, after the duck.
      const floor = Math.max(blend.at, aLanes.from, minStart);
      const downs = A.tl.downbeatsBetween(floor - 1e-6, T - barA + 1e-6).filter((d) => d.index < i);
      const want = pick(cfg.bars[phase.name], rng);
      const swapAt = downs.find((d) => d.index === i - want) ?? downs[downs.length - 1];
      if (!swapAt) throw new Error('D16: no downbeat to swap on (the planner checks the lanes and the layer)');
      const L = swapAt.ctxTime;
      const aStop = gapStart + 0.05;
      const lowered = A.level * dbToGain(cfg.aDownDb);
      const events: PlanEvent[] = [
        // A's singer out, B's in (a quarter beat), A making room.
        { kind: 'stemLane', deck: 'A', part: 'vocals', at: L, until: aStop, direct: [[L, 0], [L + 0.01, -1]] },
        {
          kind: 'blend', deck: 'B', at: L, until: pickupAt, fileAt: blend.fileAt + (L - blend.at),
          parts: { vocals: { from: SILENT, to: cfg.vocals, t0: L, t1: L + beatA / 4 } }, hpfHz: cfg.hpfHz,
        },
        ramp('A.gain', L, L + 0.05, A.level, lowered, 'lin'),
        ramp('A.hpf', L, L + 0.05, 20, cfg.aHpfHz, 'exp'),
      ];
      const kind = forced(x, D16_EXITS) ?? weightedPick(cfg.exits, rng) ?? 'echo';
      const exit = EXITS[kind].build({ A: { ...A, level: lowered }, i, end: gapStart, rng, tailBeats: 1 });
      events.push(...exit.events);
      const loud = riserLoud(phase, { early: -12, mid: -10, late: -8, final: -6 });
      events.push(synth('riser', { t0: Math.max(L, T - 2 * barA), t1: gapStart, fromHz: 800, toHz: 9000, fromDb: loud - 24, toDb: loud, tone: false }));
      events.push(...swellLayer(landing, gapStart - Math.min(barA, 2 * beatA), gapStart, loud - 1));
      // B's own mix takes over from its stretched voice on the pickup, then the impact.
      events.push(set('B.gain', bStart, SILENT));
      events.push(ramp('B.gain', pickupAt - LAYERING.handoverSec, pickupAt, SILENT, 1, 'lin'));
      events.push(...impactLayer({ T, phase, landing }));
      return { events, aStopAt: exit.aStopAt, variant: { kind, bars: i - swapAt.index } };
    },
  },

  // D19 · Scratch-in: A exits as in R7, the build runs on B's grid (its roll down), and B's first syllable is
  // scratched back and forth on B's eighths over the last beats (baby, chirp or forward strokes), released forward
  // into the pickup, where the whole word comes in with the song.
  D19: {
    id: 'D19',
    name: 'Scratch-in',
    shape: 'S2',
    implemented: true,
    family: 'scratch',
    exits: R7_EXITS,
    needs: (caps) => caps.chop != null,
    minGapBeats: (phase) => MOVES.scratch.minGapBeats[phase],
    aLeadSec: exitLead('D19'),
    build(x) {
      const { e, gapStart, pickupAt, gB, phase, rng, chop, landing } = x;
      if (!chop) throw new Error('D19 needs a grain to scratch');
      const out = s2Exit(x);
      const events = [...out.events, ...buildLayers({ t0: e, gapStart, pickupAt, gB, phase, rng, landing, rollScale: MOVES.scratch.rollScale })];
      const scratch = scratchMove({ source: chop, pickupAt, from: e, beats: MOVES.scratch.beats[phase.name], gB, phase: phase.name, signatureDb: phase.signatureDb, rng, style: forced(x, SCRATCH_STYLES) });
      if (scratch) events.push(scratch.event);
      events.push(...landB(x));
      return { events, aStopAt: out.aStopAt, variant: { kind: scratch?.style ?? 'none', beats: scratch?.beats ?? 0 }, usesBSignature: Boolean(scratch) && chop.from === 'signature' };
    },
  },

  // Fallback when A offers no usable downbeat: echo out wherever A is, then the landing.
  // Suspense (plan/suspense.ts): the presenters hold the build open; after the release this is its final bar
  // on B's grid (riser, roll, swell, the silence) and the landing. A left at the start, so it is not here.
  // Never drawn by the rotation (`implemented: false`): only a presenter starts it.
  SUSPENSE: {
    id: 'SUSPENSE',
    name: 'Suspense',
    shape: 'S2',
    implemented: false,
    family: 'build',
    aLeadSec: () => 0,
    build(x) {
      const { e, gapStart, pickupAt, gB, phase, landing } = x;
      return { events: [...buildLayers({ t0: e, gapStart, pickupAt, gB, phase, landing }), ...landB(x)], aStopAt: null };
    },
  },
  FADE: {
    id: 'FADE',
    name: 'Echo fade (fallback)',
    shape: 'S0',
    implemented: true,
    family: 'echo',
    aLeadSec: () => 1,
    build(x) {
      const { A, gapStart } = x;
      const events: PlanEvent[] = A ? [ramp('A.gain', Math.max(gapStart - 1, 0), gapStart, A.level, SILENT, 'lin')] : [];
      // The fallback always keeps its swell: it is its only effect.
      events.push(synth('swell', { t0: gapStart - 1, t1: gapStart, peakDb: -10 }), ...landB(x));
      return { events, aStopAt: gapStart + 0.05 };
    },
  },
};

/** Ids of the theatrical recipes. Typed by string so any id (or a history entry's) can be tested. */
export const THEATRICAL: ReadonlySet<string> = new Set(Object.values(RECIPES).filter((r) => r.theatrical).map((r) => r.id));
export const DEFAULT_WEIGHTS: Readonly<Partial<Record<RecipeId, number>>> = { R7: 0.5, R2: 0.25, R4: 0.25 };

/**
 * Families that count as one for "never three in a row": the spiral is an echo to the ear. Typed by string so
 * a history entry's family can be looked up.
 */
const FAMILY_GROUPS: Readonly<Partial<Record<string, string>>> = { spiral: 'echo' };
export const familyGroup = (family: string): string => FAMILY_GROUPS[family] ?? family;
