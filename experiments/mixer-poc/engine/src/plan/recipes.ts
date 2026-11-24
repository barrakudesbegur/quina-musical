// Transition recipes. Each one is pure: it returns abstract timed events that scheduler.ts maps onto
// Web Audio. Times are AudioContext seconds. A = outgoing deck, B = incoming deck, T = the moment B's
// hook downbeat sounds (and the drum locks). Every recipe is a DJ move with effects — never a bare
// volume change — and every landing gets a swell and an impact.
//
// Event shapes (PlanEvent below):
//   { kind: 'set',  target, at, value }
//   { kind: 'ramp', target, t0, t1, from, to, curve: 'lin' | 'exp' }
//   { kind: 'sfx',  name, at, gainDb }                 repo samples, whoosh, thunk
//   { kind: 'synth', name, params }                    riser, snareRoll, swell, impact, kicks, downlifter
//   { kind: 'slices', deck: 'A', slices: [{at, offset, dur, gain}] }   loop roll
//   { kind: 'spinback', deck: 'A', at, fromPos, seconds, rateFrom, dur }
//   { kind: 'stems', deck: 'B', at, until, parts }      a Tease from B's own stems
//   { kind: 'blend', deck: 'B', at, until, fileAt, parts }   B stretched to A's tempo (R8)
// Targets: A|B . gain hpf lpf echoSend reverbSend rate · echo.time echo.feedback echo.hpf echo.return ·
//          reverb.return reverb.hpf · bus.hpf
import { LAYERING } from '../config.ts';
import type { PhaseEffects } from '../config.ts';
import type { ExitName, RecipeFamily, RecipeId, RecipeShape } from '@quina/protocol';
import type { HookGrid, Timeline } from './timeline.ts';

// The transition vocabulary is part of the show protocol. Shapes: S1 rides A and lands on its downbeat,
// S2 bridges on B's grid, S3 layers B (stretched to A's tempo) under A and lands on A's downbeat, S0 is
// the fallback without a downbeat. Rotation never plays one family three times in a row.
export type { ExitName, RecipeFamily, RecipeId, RecipeShape } from '@quina/protocol';

/** An audio parameter the scheduler can set or ramp: a deck's own chain, or a shared send or bus. */
export type ParamTarget =
  | `${'A' | 'B'}.${'gain' | 'hpf' | 'lpf' | 'echoSend' | 'reverbSend' | 'rate'}`
  | 'echo.time' | 'echo.feedback' | 'echo.hpf' | 'echo.return' | 'reverb.return' | 'reverb.hpf' | 'bus.hpf';

/** Parameters of each synth voice, as audio/synth/fx.ts reads them. Times are AudioContext seconds. */
export interface SynthParams {
  riser: { t0: number; t1: number; fromHz: number; toHz: number; fromDb: number; toDb: number; tone?: boolean };
  snareRoll: { t0: number; t1: number; beat: number; pitchTo: number; stages: number[]; velFrom: number; velTo: number };
  swell: { t0: number; t1: number; peakDb: number };
  impact: { at: number; level: number };
  kicks: { times: number[]; level: number };
  downlifter: { t0: number; t1: number; peakDb: number };
}
export type SynthName = keyof SynthParams;

/** One slice of a loop roll: A's audio from `offset`, played at `at` for `dur`. */
export interface Slice {
  at: number;
  offset: number;
  dur: number;
  gain: number;
}

// The timed events a recipe returns, discriminated by `kind`. A synth event is further discriminated by `name`.
export interface SetEvent {
  kind: 'set';
  target: ParamTarget;
  at: number;
  value: number;
}

export interface RampEvent {
  kind: 'ramp';
  target: ParamTarget;
  t0: number;
  t1: number;
  from: number;
  to: number;
  curve: 'lin' | 'exp';
}

export interface SfxEvent {
  kind: 'sfx';
  name: string;
  at: number;
  gainDb: number;
}

/** One synth voice, by name: `{ kind: 'synth', name: 'riser', params: SynthParams['riser'] }`. */
export type SynthEventOf<N extends SynthName> = { kind: 'synth'; name: N; params: SynthParams[N] };
export type SynthEvent = { [N in SynthName]: SynthEventOf<N> }[SynthName];

export interface SlicesEvent {
  kind: 'slices';
  deck: 'A';
  slices: Slice[];
}

export interface SpinbackEvent {
  kind: 'spinback';
  deck: 'A';
  at: number;
  fromPos: number;
  seconds: number;
  rateFrom: number;
  dur: number;
}

/** B's stems a Tease or a Blend may play. */
export type StemName = 'drums' | 'bass' | 'vocals';

/** How one stem comes in: from `from` to `to` over [t0, t1], then held. */
export interface StemEnvelope {
  from: number;
  to: number;
  t0: number;
  t1: number;
}

export type StemParts = Partial<Record<StemName, StemEnvelope>>;

/**
 * Parts of B's own stems, played in sync with B's timeline over [at, until] (a Tease at B's tempo). Each
 * part ramps from `from` to `to` over [t0, t1], holds, and is cut (10 ms) at `until`.
 */
export interface StemsEvent {
  kind: 'stems';
  deck: 'B';
  at: number;
  until: number;
  parts: StemParts;
}

/**
 * B's bars before its hook, stretched to A's tempo (the Blend, R8): the render's file time `fileAt` plays at
 * `at`, so its hook downbeat plays at the landing; parts ramp in like StemsEvent and are cut at `until`.
 */
export interface BlendEvent {
  kind: 'blend';
  deck: 'B';
  at: number;
  until: number;
  fileAt: number;
  parts: StemParts;
}

/**
 * An approved Signature of the deck's song (its own file): its anchor (first downbeat, or a shout's
 * attack) sounds at `at`, resampled by `rate`; it fades out at `until`. `echo` sends it into the echo bus.
 */
export interface SignatureEvent {
  kind: 'signature';
  deck: 'A' | 'B';
  id: string;
  at: number;
  anchorSec: number;
  rate: number;
  gainDb: number;
  until: number;
  echo: number;
}

/**
 * A Decoy (plan/decoys.ts, an experiment that is off by default): another, already-landed song plays from
 * `offset` at `at`, low-passed, until a tape stop at `cutAt` over `cutSec` cuts it off.
 */
export interface DecoyEvent {
  kind: 'decoy';
  songId: number;
  at: number;
  offset: number;
  cutAt: number;
  cutSec: number;
  gainDb: number;
  lpfHz: number;
}

export type PlanEvent = SetEvent | RampEvent | SfxEvent | SynthEvent | SlicesEvent | SpinbackEvent | StemsEvent | BlendEvent | SignatureEvent | DecoyEvent;
export type PlanEventKind = PlanEvent['kind'];

export const SILENT = 0.0001;
const OPEN_LPF = 22000;

export const set = (target: ParamTarget, at: number, value: number): SetEvent => ({ kind: 'set', target, at, value });
export const ramp = (target: ParamTarget, t0: number, t1: number, from: number, to: number, curve: 'lin' | 'exp' = 'lin'): RampEvent =>
  ({ kind: 'ramp', target, t0, t1, from, to, curve });
/** @param name  a repo sample, whoosh or thunk */
export const sfx = (name: string, at: number, gainDb: number = 0): SfxEvent => ({ kind: 'sfx', name, at, gainDb });
export const synth = <N extends SynthName>(name: N, params: SynthParams[N]): SynthEventOf<N> => ({ kind: 'synth', name, params });

const isList = <T>(list: readonly T[] | T): list is readonly T[] => Array.isArray(list);

/**
 * A random element of `list`. A value that is not an array comes back as is (null or undefined gives 0).
 * The casts hide two quirks no caller hits: an empty array comes back as itself, not as an element, and a
 * missing value comes back as 0 whatever T is.
 */
const pick = <T>(list: readonly T[] | T, rng: () => number): T => {
  if (!isList(list)) return list ?? (0 as T);
  return list.length ? list[Math.floor(rng() * list.length)] : (list as T);
};

// ------------------------------------------------------------------------------------------ A exits
// Each exit ends with A silent at `end`, returns { events, aStopAt }. `lead(tl, i)` = seconds before `end`
// the move needs (so the planner can keep it after the spin starts).

/** The outgoing deck as recipes see it: its timeline, and its level after the spin-start duck. */
export interface OutgoingDeck {
  tl: Timeline;
  level: number;
}

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

export const EXITS = {
  // Tempo-synced echo-out with a rising high-pass on A and on the echo return.
  echo: {
    lead: (tl, i) => (tl.barAt(i) > 2.5 ? 2 * tl.beatAt(i) : tl.barAt(i)),
    build({ A, i, end, tailBeats = 2, rng }: ExitArgs & { i: number; rng: () => number }) {
      const barA = A.tl.barAt(i);
      const beatA = A.tl.beatAt(i);
      const start = end - (barA > 2.5 ? 2 * beatA : barA);
      const delayBeats = rng() < 0.65 ? 0.5 : 0.75;
      return {
        aStopAt: end + 0.05,
        events: [
          set('echo.time', start, delayBeats * beatA),
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
    build({ A, i, end, bars = 1 }: ExitArgs & { i: number }) {
      const beatA = A.tl.beatAt(i);
      const bpb = A.tl.bpb;
      const rollStart = end - bars * bpb * beatA;
      const offset = A.tl.posAt(rollStart);
      const plan: [number, number][] = []; // [slice length in beats, count]
      if (bars >= 2) plan.push([1, bpb]);
      plan.push([0.5, 2], [0.25, 4], [0.125, 8], [0.0625, 8]);
      const slices: Slice[] = [];
      let at = rollStart;
      let k = 0;
      for (const [len, count] of plan) {
        for (let c = 0; c < count; c++) {
          const dur = len * beatA;
          slices.push({ at, offset, dur, gain: 0.8 + 0.2 * (k / 26) });
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
} satisfies Record<ExitName, ExitMove>;

// -------------------------------------------------------------------------------------- B landings
// B: hook downbeat at T. `pickupAt` = T − pickup (B is fully open from there). Optional Tease before the
// landing, cut to silence for the gap, then the full song bursts in on the pickup:
//  - from B's own stems when they cover the hook: its drums come in, then its bass for the last bar, at
//    B's tempo and phase-locked to the hook (a DJ bringing in the next track's groove);
//  - otherwise B's full mix through a closed low-pass.
/** What a landing of B needs from the recipe's BuildArgs. */
export type LandingArgs = Pick<BuildArgs, 'T' | 'pickupAt' | 'gapStart' | 'bStart' | 'tease' | 'teaseStems' | 'gB' | 'phase'>;

export function landB({ T, pickupAt, gapStart, bStart, tease, teaseStems, gB, phase }: LandingArgs): PlanEvent[] {
  const events: PlanEvent[] = [];
  if (tease && teaseStems?.includes('drums') && gapStart - bStart > gB.beat) {
    const span = gapStart - bStart;
    const parts: StemParts = { drums: { from: SILENT, to: 0.9, t0: bStart, t1: bStart + Math.min(gB.bar, span / 2) } };
    if (teaseStems.includes('bass') && span >= 1.5 * gB.bar) {
      const t0 = gapStart - gB.bar;
      parts.bass = { from: SILENT, to: 0.8, t0, t1: t0 + gB.beat };
    }
    events.push({ kind: 'stems', deck: 'B', at: bStart, until: gapStart, parts });
    events.push(set('B.gain', bStart, SILENT));
    events.push(ramp('B.gain', pickupAt - 0.003, pickupAt, SILENT, 1, 'lin'));
  } else if (tease) {
    events.push(set('B.lpf', bStart, 380));
    events.push(ramp('B.gain', bStart, bStart + gB.bar / 2, SILENT, 0.3, 'lin'));
    events.push(ramp('B.lpf', bStart + gB.bar / 2, gapStart, 380, 1400, 'exp'));
    events.push(ramp('B.gain', gapStart - 0.01, gapStart, 0.3, SILENT, 'lin'));
    events.push(set('B.lpf', pickupAt - 0.002, OPEN_LPF));
    events.push(ramp('B.gain', pickupAt - 0.003, pickupAt, SILENT, 1, 'lin'));
  } else {
    events.push(ramp('B.gain', bStart, pickupAt, SILENT, 1, 'lin'));
  }
  events.push(...impactLayer({ T, phase }));
  return events;
}

export function impactLayer({ T, phase }: { T: number; phase: PhaseEffects }): PlanEvent[] {
  const level = { early: 0.45, mid: 0.6, late: 0.75, final: 0.9 }[phase.name] ?? 0.6;
  const events: PlanEvent[] = [synth('impact', { at: T, level })];
  const samples = phase.impactSamples || [];
  for (const [name, db] of samples) events.push(sfx(name, T - 0.03, db));
  return events;
}

// The build over a bridge [t0, gapStart] on B's grid: noise riser, accelerating snare roll, reverse
// cymbal into the gap, and the music-bus high-pass sweeping up in the last bar (off at the landing).
/** @returns empty when the bridge is shorter than 0.3 s */
export function buildLayers({ t0, gapStart, pickupAt, gB, phase, roll = true }: {
  t0: number; gapStart: number; pickupAt: number; gB: HookGrid; phase: PhaseEffects; roll?: boolean;
}): PlanEvent[] {
  const span = gapStart - t0;
  const events: PlanEvent[] = [];
  if (span < 0.3) return events;
  const loud = { early: -12, mid: -9, late: -7, final: -5 }[phase.name] ?? -9;
  events.push(synth('riser', { t0, t1: gapStart, fromHz: 700, toHz: 9500, fromDb: loud - 24, toDb: loud }));
  if (roll) {
    const beats = span / gB.beat;
    const stages = beats >= 6 ? [1, 0.5, 0.25, 0.125] : beats >= 3 ? [0.5, 0.25, 0.125] : [0.25, 0.125];
    events.push(synth('snareRoll', { t0, t1: gapStart, beat: gB.beat, pitchTo: phase.snarePitch ?? 5, stages, velFrom: 50, velTo: 122 }));
  }
  events.push(synth('swell', { t0: Math.max(t0, gapStart - 2 * gB.beat), t1: gapStart, peakDb: loud - 2 }));
  const sweepStart = Math.max(t0, gapStart - gB.bar);
  events.push(ramp('bus.hpf', sweepStart, gapStart, 10, 380, 'exp'));
  events.push(set('bus.hpf', pickupAt - 0.002, 10));
  return events;
}

// ------------------------------------------------------------------------------------------ recipes
// Shared build() args: { A:{tl, level}|null, i (A exit downbeat index), e (exit time), T, pickupAt,
//   gapStart, bStart, tease, gB:{bar,beat}, phase, rng, exit (variant name) }

/** Where B's stretched layer starts (ctx time), the file time playing then, how many bars, and whether B's bass layers too. */
export interface BlendLayer {
  at: number;
  fileAt: number;
  bars: number;
  bass: boolean;
}

export interface BuildArgs {
  A: OutgoingDeck | null;
  i: number | null;
  e: number;
  T: number;
  pickupAt: number;
  gapStart: number;
  bStart: number;
  tease: boolean;
  teaseStems?: readonly StemName[] | null;
  gB: HookGrid;
  phase: PhaseEffects;
  rng: () => number;
  exit: ExitName | null;
  blend?: BlendLayer | null;
}

/** S1 recipes only run with A playing and one of its downbeats chosen (planner.ts guarantees both). */
export type S1BuildArgs = BuildArgs & { A: OutgoingDeck; i: number };

/** The variant a recipe drew, as the plan reports it. */
export type RecipeVariant = { bars: number } | { kind: 'spinback' | 'brake' } | { kind: ExitName; bars: number; bass: boolean };

export interface RecipeResult {
  events: PlanEvent[];
  aStopAt: number | null;
  variant?: RecipeVariant;
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
  /** Seconds of A the move needs before `gapStart` (S1) or `e` (S2). */
  aLeadSec: (tl: Timeline, i: number, exit?: ExitName | null) => number;
  build: (x: BuildArgs) => RecipeResult;
}

/**
 * The args of an S1 or S3 recipe, which only runs with A playing and one of its downbeats chosen
 * (planner.ts guarantees both).
 */
function riding(x: BuildArgs): S1BuildArgs {
  const { A, i } = x;
  if (!A || i == null) throw new Error('an S1 or S3 recipe needs A playing and an A downbeat');
  return { ...x, A, i };
}

export const RECIPES: Record<RecipeId, Recipe> = {
  // R1 · Slam cut: A's high-pass and a riser climb over its last bar, swell, cut, impact on the one.
  R1: {
    id: 'R1',
    name: 'Slam cut',
    shape: 'S1',
    implemented: true,
    family: 'cut',
    aLeadSec: (tl, i) => tl.barAt(i),
    build(x) {
      const { A, i, gapStart } = riding(x);
      const barA = A.tl.barAt(i);
      const events = [
        ramp('A.hpf', gapStart - barA, gapStart, 20, 600, 'exp'),
        ramp('A.gain', gapStart - 0.01, gapStart, A.level, SILENT, 'lin'),
        synth('riser', { t0: gapStart - barA, t1: gapStart, fromHz: 900, toHz: 9000, fromDb: -36, toDb: -10, tone: false }),
        synth('swell', { t0: gapStart - Math.min(barA, 2 * x.gB.beat), t1: gapStart, peakDb: -10 }),
        ...landB(x),
      ];
      return { events, aStopAt: gapStart + 0.05 };
    },
  },

  // R2 · Echo-out with a filter sweep and riser into the hook.
  R2: {
    id: 'R2',
    name: 'Echo-out',
    shape: 'S1',
    implemented: true,
    family: 'echo',
    aLeadSec: (tl, i) => tl.barAt(i), // the riser starts a full bar of A before the gap
    build(x) {
      const { A, i, gapStart, rng } = riding(x);
      const exit = EXITS.echo.build({ A, i, end: gapStart, rng, tailBeats: 1 });
      const barA = A.tl.barAt(i);
      const events = [
        ...exit.events,
        synth('riser', { t0: gapStart - barA, t1: gapStart, fromHz: 800, toHz: 8000, fromDb: -36, toDb: -11, tone: false }),
        synth('swell', { t0: gapStart - Math.min(barA, 2 * x.gB.beat), t1: gapStart, peakDb: -11 }),
        ...landB(x),
      ];
      return { events, aStopAt: exit.aStopAt };
    },
  },

  // R4 · Loop roll: A stutters faster and faster, then the hook lands.
  R4: {
    id: 'R4',
    name: 'Loop roll',
    shape: 'S1',
    implemented: true,
    family: 'roll',
    theatrical: true,
    aLeadSec: (tl, i) => 2 * tl.barAt(i),
    build(x) {
      const { A, i, gapStart, phase } = riding(x);
      const bars = phase.name === 'early' || A.tl.barAt(i) > 2.4 ? 1 : 2;
      const exit = EXITS.roll.build({ A, i, end: gapStart, bars });
      const rollStart = gapStart - bars * A.tl.barAt(i);
      const events = [
        ...exit.events,
        synth('riser', { t0: rollStart, t1: gapStart, fromHz: 1000, toHz: 10000, fromDb: -34, toDb: -10, tone: true }),
        ...landB(x),
      ];
      return { events, aStopAt: exit.aStopAt, variant: { bars } };
    },
  },

  // R5 · Brake or spinback, a breath of silence, then the hook.
  R5: {
    id: 'R5',
    name: 'Brake / spinback',
    shape: 'S1',
    implemented: true,
    family: 'stop',
    theatrical: true,
    aLeadSec: () => 1.2,
    build(x) {
      const { A, gapStart, rng } = riding(x);
      const kind = rng() < 0.5 ? 'spinback' : 'brake';
      const exit = EXITS[kind].build({ A, end: gapStart });
      const events = [...exit.events, synth('swell', { t0: gapStart - 0.6, t1: gapStart, peakDb: -12 }), ...landB(x)];
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
      const { A, i, gapStart, T, gB } = riding(x);
      const exit = EXITS.wash.build({ A, i, end: gapStart });
      const events = [
        ...exit.events,
        synth('swell', { t0: gapStart - A.tl.barAt(i), t1: gapStart, peakDb: -9 }),
        ramp('reverb.return', T, T + 2 * gB.beat, 1, SILENT, 'lin'),
        set('reverb.return', T + 2 * gB.beat + 0.05, 1),
        set('A.reverbSend', T + 0.01, 0),
        ...landB(x),
      ];
      return { events, aStopAt: exit.aStopAt };
    },
  },

  // R7 · Build: A exits (echo / roll / brake / spinback / wash), then N bars of riser + snare roll on B's
  // grid, a Tease of B through a low-pass, a beat of silence, and the landing with a layered impact.
  R7: {
    id: 'R7',
    name: 'Build & land',
    shape: 'S2',
    implemented: true,
    family: 'build',
    exits: ['echo', 'roll', 'brake', 'spinback', 'wash'],
    aLeadSec: (tl, i, exit) => {
      // The planner passes the exit it drew from `exits`, so it is never null here.
      if (!exit) throw new Error('R7 needs an exit move');
      return EXITS[exit].lead(tl, i);
    },
    build(x) {
      const { A, i, e, gapStart, pickupAt, gB, phase, rng, exit } = x;
      const events: PlanEvent[] = [];
      let aStopAt: number | null = null;
      if (A) {
        // With A playing, the planner always passes A's exit downbeat and an exit drawn from `exits`.
        if (i == null || !exit) throw new Error('R7 needs A\'s exit downbeat and an exit move');
        const out = EXITS[exit].build({ A, i, end: e, rng, bars: 1, tailBeats: 2 });
        events.push(...out.events);
        aStopAt = out.aStopAt;
      }
      events.push(...buildLayers({ t0: e, gapStart, pickupAt, gB, phase }));
      events.push(...landB(x));
      void rng;
      return { events, aStopAt };
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
    exits: ['brake'],
    aLeadSec: () => 1.6,
    build(x) {
      const { A, e, gapStart, pickupAt, gB, phase } = x;
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
      events.push(...buildLayers({ t0: heartEnd, gapStart, pickupAt, gB, phase }));
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
    aLeadSec: (tl, i) => 2 * tl.barAt(i), // the planner places the layer itself (blendStart)
    build(x) {
      const { A, i, T, gapStart, pickupAt, bStart, phase, rng, blend } = riding(x);
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
      const loud = { early: -12, mid: -10, late: -8, final: -6 }[phase.name] ?? -10;
      events.push(synth('riser', { t0: Math.max(blend.at, T - 2 * barA), t1: gapStart, fromHz: 800, toHz: 9000, fromDb: loud - 24, toDb: loud, tone: false }));
      events.push(synth('swell', { t0: gapStart - Math.min(barA, 2 * beatA), t1: gapStart, peakDb: loud - 1 }));
      // B's own mix takes over from the stretched layer on the pickup, then the impact.
      events.push(set('B.gain', bStart, SILENT));
      events.push(ramp('B.gain', pickupAt - LAYERING.handoverSec, pickupAt, SILENT, 1, 'lin'));
      events.push(...impactLayer({ T, phase }));
      return { events, aStopAt: out.aStopAt, variant: { kind, bars: blend.bars, bass: Boolean(parts.bass) } };
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
      const { e, gapStart, pickupAt, gB, phase } = x;
      return { events: [...buildLayers({ t0: e, gapStart, pickupAt, gB, phase }), ...landB(x)], aStopAt: null };
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
      events.push(synth('swell', { t0: gapStart - 1, t1: gapStart, peakDb: -10 }), ...landB(x));
      return { events, aStopAt: gapStart + 0.05 };
    },
  },
};

/** Ids of the theatrical recipes. Typed by string so any id (or a history entry's) can be tested. */
export const THEATRICAL: ReadonlySet<string> = new Set(Object.values(RECIPES).filter((r) => r.theatrical).map((r) => r.id));
export const DEFAULT_WEIGHTS: Readonly<Partial<Record<RecipeId, number>>> = { R7: 0.5, R2: 0.25, R4: 0.25 };
export { pick };
