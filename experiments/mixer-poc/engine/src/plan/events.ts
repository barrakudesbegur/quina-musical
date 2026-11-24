// The timed events a plan is made of, and their constructors. Recipes, moves and layers build them; only
// audio/scheduler.ts maps them onto Web Audio. Times are AudioContext seconds. A = the outgoing deck,
// B = the incoming deck.
//
// Targets: A|B . gain hpf lpf echoSend reverbSend rate · echo.time echo.feedback echo.hpf echo.return ·
//          reverb.return reverb.hpf · bus.hpf

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
  /** P4: hand claps (three band-passed noise bursts each), or a stomp when `stomp`. */
  claps: { times: number[]; level: number; stomp?: boolean };
}
export type SynthName = keyof SynthParams;

/** A deck's own stems (analysis/stems.py): stored drums, bass and vocals. */
export type StemName = 'drums' | 'bass' | 'vocals';
/** A part of a deck's mix a stem lane can play or remove: a stored stem, or `other` (mix − the stems). */
export type LanePart = StemName | 'other';
export const LANE_PARTS = ['drums', 'bass', 'vocals', 'other'] as const satisfies readonly LanePart[];

/** One slice of a loop roll or a chop: audio from `offset`, played at `at` for `dur`, resampled by `rate`. */
export interface Slice {
  at: number;
  offset: number;
  dur: number;
  gain: number;
  /** Playback rate (pitch and speed); 1 when left out. */
  rate?: number;
}

/**
 * Where a slices event reads its audio (P2). `mix` and `stem` offsets are song seconds (a stem is read
 * from the deck's decoded stems); a `signature` offset is seconds in that Signature's own file.
 */
export type SliceSource = { from: 'mix' } | { from: 'stem'; part: StemName } | { from: 'signature'; id: string };

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

/**
 * Slices of a deck's audio (a loop roll, a vocal chop). By default A's mix through the deck's chain
 * (filters and fader apply). P2: `source` reads a stem or a Signature instead; `direct` plays past the
 * deck's fader (a chop of B while B is still closed); `fadeMs` and `hpfHz` shape every slice.
 */
export interface SlicesEvent {
  kind: 'slices';
  deck: 'A' | 'B';
  slices: Slice[];
  source?: SliceSource;
  direct?: boolean;
  fadeMs?: number;
  hpfHz?: number;
  /**
   * Snap every slice's offset to the source's onset: the first loud point within `searchSec` of the first
   * slice's offset, then past at most `consonantSec` of noise-like consonant, so the grain starts on a vowel.
   */
  snap?: { searchSec: number; consonantSec: number };
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

/** Breakpoints `[time, value]`: linear between them, held before the first and after the last. */
export type LanePoints = readonly (readonly [number, number])[];

/**
 * P1, a stem lane: one part of the deck's own song, sample-locked to its main source over [at, until] (cut
 * in 5 ms at `until`). Levels are in part units, where 1 is the part as it sounds in the mix:
 * - `direct` goes into the deck's chain (trim → filters → fader), so −1 removes the part from the deck's
 *   mix and 0 leaves the mix as it is;
 * - `echo` and `reverb` send the part alone into the shared echo or reverb, past the fader (a vocal throw, a
 *   ghost).
 * A lane only plays while the deck runs at rate 1, inside its decoded stems.
 */
export interface StemLaneEvent {
  kind: 'stemLane';
  deck: 'A' | 'B';
  part: LanePart;
  at: number;
  until: number;
  direct: LanePoints;
  echo?: LanePoints;
  reverb?: LanePoints;
}

/**
 * P3, a pre-verb swell (D12): the render of B's first beat reversed through the reverb, played over
 * [at, until] so it ends a breath before B's pickup, with a high-pass, past B's fader.
 */
export interface PreverbEvent {
  kind: 'preverb';
  deck: 'B';
  hookId: string;
  at: number;
  until: number;
  gainDb: number;
  hpfHz: number;
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

export type PlanEvent =
  | SetEvent | RampEvent | SfxEvent | SynthEvent | SlicesEvent | SpinbackEvent | StemsEvent | BlendEvent | StemLaneEvent
  | PreverbEvent | SignatureEvent | DecoyEvent;
export type PlanEventKind = PlanEvent['kind'];

export const SILENT = 0.0001;
export const OPEN_LPF = 22000;

export const set = (target: ParamTarget, at: number, value: number): SetEvent => ({ kind: 'set', target, at, value });
export const ramp = (target: ParamTarget, t0: number, t1: number, from: number, to: number, curve: 'lin' | 'exp' = 'lin'): RampEvent =>
  ({ kind: 'ramp', target, t0, t1, from, to, curve });
/** @param name  a repo sample, whoosh or thunk */
export const sfx = (name: string, at: number, gainDb: number = 0): SfxEvent => ({ kind: 'sfx', name, at, gainDb });
export const synth = <N extends SynthName>(name: N, params: SynthParams[N]): SynthEventOf<N> => ({ kind: 'synth', name, params });
export const dbToGain = (db: number): number => 10 ** (db / 20);

const isList = <T>(list: readonly T[] | T): list is readonly T[] => Array.isArray(list);

/**
 * A random element of `list`. A value that is not an array comes back as is (null or undefined gives 0).
 * The casts hide two quirks no caller hits: an empty array comes back as itself, not as an element, and a
 * missing value comes back as 0 whatever T is.
 */
export const pick = <T>(list: readonly T[] | T, rng: () => number): T => {
  if (!isList(list)) return list ?? (0 as T);
  return list.length ? list[Math.floor(rng() * list.length)] : (list as T);
};

/** A uniform draw in [lo, hi). */
export const between = (lo: number, hi: number, rng: () => number): number => lo + (hi - lo) * rng();

/** When an event starts: its `at` or `t0`, its synth's start, its first slice, or a Signature's file start. */
export function eventStart(x: PlanEvent): number {
  switch (x.kind) {
    case 'set':
    case 'sfx':
    case 'spinback':
    case 'stems':
    case 'blend':
    case 'stemLane':
    case 'preverb':
    case 'decoy':
      return x.at;
    case 'signature':
      return x.at - x.anchorSec / x.rate;
    case 'ramp':
      return x.t0;
    case 'synth': {
      const { params } = x;
      if ('t0' in params) return params.t0;
      if ('at' in params) return params.at;
      return params.times[0] ?? 0;
    }
    case 'slices':
      return x.slices[0]?.at ?? 0;
  }
}

/** When an event is over (its last sound may ring on through a send). */
export function eventEnd(x: PlanEvent): number {
  switch (x.kind) {
    case 'set':
    case 'sfx':
      return x.at;
    case 'spinback':
      return x.at + x.dur;
    case 'decoy':
      return x.cutAt + x.cutSec;
    case 'signature':
    case 'stems':
    case 'blend':
    case 'stemLane':
    case 'preverb':
      return x.until;
    case 'ramp':
      return x.t1;
    case 'synth': {
      const { params } = x;
      if ('t1' in params) return params.t1;
      if ('at' in params) return params.at;
      return params.times[params.times.length - 1] ?? 0;
    }
    case 'slices':
      return Math.max(0, ...x.slices.map((s) => s.at + s.dur));
  }
}
