// Moves of the outgoing deck A that recipes and exits share (docs/dj-techniques.md): D1's gate and pump,
// D3's spiral echo, D2's stop-time stabs and D8's stem peel. Each is pure and returns plan events; each
// works on A's own grid (its beats before the landing downbeat) and leaves A silent at `end`.
import { MOVES } from '../config.ts';
import type { PhaseName } from '../config.ts';
import { weightedPick } from '../rng.ts';
import { SILENT, dbToGain, pick, ramp, set, sfx, synth } from './events.ts';
import type { LanePart, LanePoints, PlanEvent, StemLaneEvent } from './events.ts';
import type { Timeline } from './timeline.ts';

/** Per-bar RMS of a song's stems (data/stems `bars`, dB), by downbeat index. */
export type StemBars = Readonly<Partial<Record<LanePart, readonly number[]>>>;

/** The outgoing deck as recipes see it: its timeline, its level after the spin-start duck, its stems' bar levels. */
export interface OutgoingDeck {
  tl: Timeline;
  level: number;
  bars?: StemBars | null;
}

/** Where A's stem lanes may play (P1): context times inside its decoded stems, and the parts it has. */
export interface LaneWindow {
  from: number;
  to: number;
  parts: readonly LanePart[];
}

/** A's beat and bar before downbeat `i`, and `end`: the last of A's beat lines at or before `limit`. */
export function aGrid(A: OutgoingDeck, i: number, T: number, limit: number): { barA: number; beatA: number; end: number } {
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const back = Math.max(0, Math.ceil((T - limit) / beatA - 1e-6));
  return { barA, beatA, end: T - back * beatA };
}

/** How many of A's bars (at most `want`, at least 1) fit between `floor` and `end`. */
export function fitBars(want: number, end: number, barA: number, floor: number): number {
  return Math.max(1, Math.min(want, Math.floor((end - floor) / barA + 1e-6)));
}

/** A stem lane of A that removes `part` from `at` (over `dur`) until `until`. */
export function removeLane(part: LanePart, at: number, dur: number, until: number): StemLaneEvent {
  return { kind: 'stemLane', deck: 'A', part, at, until, direct: [[at, 0], [at + dur, -1]] };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/** True when A's drums in the bars before downbeat `i` are far under the song's median (a gate would sound like dropouts). */
export function sparseDrums(A: OutgoingDeck, i: number, bars: number): boolean {
  const drums = A.bars?.drums;
  if (!drums?.length) return false;
  const span = drums.slice(Math.max(0, i - bars), i);
  if (!span.length) return false;
  return span.reduce((a, b) => a + b, 0) / span.length < median(drums) + MOVES.gate.sparseDrumsDb;
}

// ------------------------------------------------------------------------------------- D1 gate and pump
export const GATE_MODES = ['gate', 'pump', 'gatePump'] as const;
export type GateMode = (typeof GATE_MODES)[number];

/** Gate ladders in beats (for 4 beats a bar): [step, span] stages, 1 bar each early and mid, 2 bars late. */
const EARLY_LADDERS: readonly (readonly (readonly [number, number])[])[] = [
  [[0.5, 2], [0.25, 2]],
  [[1, 1], [0.5, 1], [0.25, 2]],
];
const MID_LADDER: readonly (readonly [number, number])[] = [[0.5, 2], [0.25, 1], [0.125, 1]];
const LATE_LADDER: readonly (readonly [number, number])[] = [[1, 4], [0.5, 2], [0.25, 1], [0.125, 1]];

export interface GateArgs {
  A: OutgoingDeck;
  /** A's downbeat whose bar is gated (the landing in S1, the exit downbeat for an exit). */
  i: number;
  end: number;
  bars: number;
  phase: PhaseName;
  rng: () => number;
  mode?: GateMode | null;
  /** The exit's gate: one bar, the mid ladder at −24 dB. */
  exit?: boolean;
}

/**
 * D1: A chopped in time over `bars` of its bars ending at `end` (a Pioneer Trans gate with a 1/16 or
 * 1/32 ladder), or pumped on every beat like a sidechain with kicks, or both. Every edge is a 2 ms ramp;
 * A's high-pass is above 250 Hz before the fast stages; A is silent at `end`.
 */
export function gateMove({ A, i, end, bars, phase, rng, mode = null, exit = false }: GateArgs): { events: PlanEvent[]; mode: GateMode; start: number } {
  const cfg = MOVES.gate;
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const bpb = A.tl.bpb;
  const start = end - bars * barA;
  let drawn: GateMode = mode ?? weightedPick(cfg.modes, rng) ?? 'gate';
  if (drawn !== 'pump' && sparseDrums(A, i, bars)) drawn = 'pump';
  const events: PlanEvent[] = [];
  const hpfTo = pick(cfg.hpfToHz, rng);
  let fastAt: number | null = null;

  if (drawn !== 'pump') {
    const ladder = bars >= 2 ? LATE_LADDER : exit || phase !== 'early' ? MID_LADDER : pick(EARLY_LADDERS, rng);
    const closedDb = exit ? -24 : bars >= 2 ? cfg.closedDb[phase] ?? cfg.closedDb.late : cfg.closedDb[phase] ?? -24;
    const closed = closedDb == null ? SILENT : A.level * dbToGain(closedDb);
    const open = A.level * dbToGain(cfg.openLiftDb);
    const duty = pick(cfg.duty, rng);
    const tresillo = rng() < cfg.tresillo;
    const edge = cfg.edgeSec;
    const scale = (bars * bpb) / ladder.reduce((sum, [, span]) => sum + span, 0);
    let t = start;
    let level = A.level;
    for (const [stepBeats, spanBeats] of ladder) {
      const step = stepBeats * beatA;
      const count = Math.round((spanBeats * scale) / stepBeats);
      if (stepBeats <= 0.25 && fastAt == null) fastAt = t;
      for (let j = 0; j < count; j++) {
        const at = t + j * step;
        if (tresillo && stepBeats === 0.25 && ![0, 3, 6].includes(j % 8)) continue;
        events.push(ramp('A.gain', at, at + edge, level, open, 'lin'));
        events.push(ramp('A.gain', at + duty * step - edge, at + duty * step, open, closed, 'lin'));
        level = closed;
      }
      t += count * step;
    }
    if (closed > SILENT) events.push(ramp('A.gain', end - edge, end, closed, SILENT, 'lin'));
  }
  if (drawn !== 'gate') {
    // The pump's kicks on every beat (louder as it goes); the pump itself only when the gate is off.
    const beats = Math.round(bars * bpb);
    for (let j = 0; j < beats; j++) {
      const at = start + j * beatA;
      const u = beats > 1 ? j / (beats - 1) : 1;
      events.push(synth('kicks', { times: [at], level: cfg.kicks[0] + (cfg.kicks[1] - cfg.kicks[0]) * u }));
      if (drawn !== 'pump') continue;
      const deep = A.level * dbToGain(cfg.pumpDb[0] + (cfg.pumpDb[1] - cfg.pumpDb[0]) * u);
      const sub = j === beats - 1 ? 2 : 1; // the last beat pumps in eighths
      for (let s = 0; s < sub; s++) {
        const p = at + (s * beatA) / sub;
        events.push(ramp('A.gain', p, p + 0.005, A.level, deep, 'lin'));
        events.push(ramp('A.gain', p + 0.005, p + (cfg.pumpRecoverBeats * beatA) / sub, deep, A.level, 'exp'));
      }
    }
    if (drawn === 'pump') events.push(ramp('A.gain', end - 0.004, end, A.level, SILENT, 'lin'));
  }
  if (fastAt != null && fastAt > start + 0.01) {
    events.push(ramp('A.hpf', start, fastAt, 20, cfg.fastStageHpfHz, 'exp'));
    events.push(ramp('A.hpf', fastAt, end, cfg.fastStageHpfHz, Math.max(hpfTo, cfg.fastStageHpfHz), 'exp'));
  } else {
    events.push(ramp('A.hpf', start, end, 20, hpfTo, 'exp'));
  }
  return { events, mode: drawn, start };
}

// ------------------------------------------------------------------------------------------ D3 spiral
export interface SpiralArgs {
  A: OutgoingDeck;
  i: number;
  end: number;
  bars: number;
  phase: PhaseName;
  rng: () => number;
  /** The repeats fall instead of climbing (only before a bridge). */
  down?: boolean;
  /** When the echo's return comes back up (after the loop is flushed). */
  restoreAt: number;
}

/**
 * D3: A's last beats caught in the echo; A's dry signal leaves and the delay shrinks exponentially, so every
 * pass is resampled higher (a real pitch spiral: DelayNode's delayTime is a-rate), the echo's high-pass
 * climbing, until the loop is cut dead and flushed at `end`.
 */
export function spiralMove({ A, i, end, bars, phase, rng, down = false, restoreAt }: SpiralArgs): { events: PlanEvent[]; start: number } {
  const cfg = MOVES.spiral;
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const start = end - bars * barA;
  const from = (down ? cfg.downBeats[0] : pick(cfg.delayBeats, rng)) * beatA;
  const to = (down ? cfg.downBeats[1] : pick(cfg.endBeats, rng)) * beatA;
  const dryEnd = bars === 1 ? start + 2 * beatA : start + barA;
  const events: PlanEvent[] = [
    set('echo.time', start, from),
    ramp('echo.feedback', start, end, cfg.feedbackFrom, cfg.feedbackTo[phase], 'lin'),
    set('echo.hpf', start, cfg.hpfFromHz),
    set('echo.return', start, 1),
    ramp('A.echoSend', start, start + beatA / 2, 0, cfg.send, 'lin'),
    ramp('A.gain', dryEnd - beatA, dryEnd, A.level, SILENT, 'lin'),
    ramp('echo.time', dryEnd, end, from, to, 'exp'),
    ramp('echo.hpf', dryEnd, end, cfg.hpfFromHz, pick(cfg.hpfToHz, rng), 'exp'),
    set('A.echoSend', end, 0),
    // Cut dead, then flush the loop before the delay and the return come back.
    ramp('echo.return', end, end + 0.005, 1, SILENT, 'lin'),
    set('echo.feedback', end + 0.01, 0),
    set('echo.time', end + 0.05, 0.25),
    set('echo.return', Math.max(restoreAt, end + 0.1), 1),
  ];
  return { events, start };
}

// ---------------------------------------------------------------------------------- D2 stop-time hits
/** Stab positions: [bar before T (1 = the last bar), beat (1-based, may be fractional)]. */
const STAB_PATTERNS: Readonly<Record<PhaseName, readonly (readonly (readonly [number, number])[])[]>> = {
  early: [[[1, 1], [1, 2], [1, 3]]],
  mid: [[[1, 1], [1, 2], [1, 3]], [[1, 1], [1, 2], [1, 3], [1, 3.5]]],
  late: [[[2, 3], [2, 4], [1, 1], [1, 2], [1, 3]]],
  final: [[[2, 1], [2, 3], [1, 1], [1, 2], [1, 3]]],
};

export interface StabsArgs {
  A: OutgoingDeck;
  i: number;
  T: number;
  /** A is silent from here (the gap before the pickup). */
  gapStart: number;
  pickupAt: number;
  minStart: number;
  phase: PhaseName;
  rng: () => number;
}

/**
 * D2: A plays only short hits on chosen beats of its last bar or two (the band's "stops"), with silence
 * between them for the crowd; the last hit rings in the reverb, which is out by the pickup. Each stab opens
 * in 3 ms, holds ⅕–⅓ of a beat and closes in 30 ms, with a kick and a thunk on it.
 */
export function stabsMove({ A, i, T, gapStart, pickupAt, minStart, phase, rng }: StabsArgs): { events: PlanEvent[]; stabs: number[]; aStopAt: number } {
  const cfg = MOVES.hits;
  const bpb = A.tl.bpb;
  const barStart = (k: number) => {
    let t = T;
    for (let b = 0; b < k; b++) t -= A.tl.barAt(i - b);
    return t;
  };
  const beatOf = (k: number) => A.tl.barAt(i - k + 1) / bpb;
  const hold = pick(cfg.holdBeats, rng) * A.tl.beatAt(i);
  const length = cfg.openSec + hold + cfg.closeSec;
  const pattern = pick(STAB_PATTERNS[phase], rng);
  const place = (shift: number) => pattern
    .map(([bar, beat]) => barStart(bar + shift) + (beat - 1) * beatOf(bar + shift))
    .filter((t) => t >= minStart && t + length <= gapStart - 0.02);
  let stabs = place(0);
  if (stabs.length < 2) {
    const earlier = place(1);
    if (earlier.length > stabs.length) stabs = earlier;
  }
  const events: PlanEvent[] = [];
  if (!stabs.length) {
    // Nothing fits (a very long pickup): one hit right before the gap.
    stabs = [Math.max(minStart, gapStart - length - 0.03)];
  }
  stabs.forEach((t, k) => {
    // A plays normally into the first stab; every later one opens from silence.
    if (k > 0) events.push(ramp('A.gain', t, t + cfg.openSec, SILENT, A.level, 'lin'));
    events.push(ramp('A.gain', t + cfg.openSec + hold, t + length, A.level, SILENT, 'lin'));
    events.push(sfx('thunk', t, cfg.thunkDb));
  });
  events.push(synth('kicks', { times: stabs, level: cfg.kick }));
  const last = stabs[stabs.length - 1];
  events.push(set('A.reverbSend', last, cfg.ringSend), set('reverb.return', last, 1));
  events.push(set('A.reverbSend', last + length + 0.02, 0));
  events.push(ramp('reverb.return', last + length, Math.max(pickupAt, last + length + 0.05), 1, SILENT, 'lin'));
  events.push(set('reverb.return', T + 1.5, 1));
  if (phase === 'late' && rng() < cfg.lateRiserChance) {
    events.push(synth('riser', { t0: stabs[0], t1: gapStart, fromHz: 900, toHz: 8000, fromDb: -42, toDb: -30 }));
  }
  return { events, stabs, aStopAt: last + length + 0.05 };
}

// -------------------------------------------------------------------------------------- D8 stem peel
export const PEEL_ORDERS = ['acapella', 'beat', 'drumsVoice'] as const;
export type PeelOrder = (typeof PEEL_ORDERS)[number];

/** Which parts go at each removal: the acapella-out, beat-and-voice then voice, or a drums-and-voice bridge. */
const PEEL_STEPS: Readonly<Record<PeelOrder, readonly (readonly LanePart[])[]>> = {
  acapella: [['drums'], ['bass'], ['other']],
  beat: [['other', 'bass'], ['drums']],
  drumsVoice: [['bass'], ['other']],
};

export interface PeelArgs {
  A: OutgoingDeck;
  i: number;
  end: number;
  bars: number;
  T: number;
  pickupAt: number;
  beatB: number;
  phase: PhaseName;
  rng: () => number;
  order?: PeelOrder | null;
}

/**
 * D8: A taken apart in front of the crowd with stem lanes: its parts removed one after another (cut on the
 * one or slid over a beat) until its singer is left (with the drums in the drums-and-voice order), under a
 * little reverb and a high-pass; on its last beat the voice is thrown into the echo, which rings into the gap.
 */
export function peelMove({ A, i, end, bars, T, pickupAt, beatB, phase, rng, order = null }: PeelArgs): { events: PlanEvent[]; order: PeelOrder; start: number; aStopAt: number } {
  const cfg = MOVES.peel;
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const start = end - bars * barA;
  const drawn: PeelOrder = order ?? weightedPick(cfg.orders, rng) ?? 'acapella';
  const steps = PEEL_STEPS[drawn];
  const aStopAt = end + 0.05;
  const throwAt = end - beatA;
  // Removal times: on the beats of a one-bar peel, else on bar lines or half bars.
  let times: number[];
  if (bars === 1) times = steps.length === 3 ? [start, start + beatA, start + 2 * beatA] : [start, start + 2 * beatA];
  else {
    const half = barA / 2;
    const step = Math.max(half, Math.floor((bars * barA) / steps.length / half + 1e-6) * half);
    times = steps.map((_, k) => start + k * step);
  }
  // Never leave one stem exposed longer than allowed: late removals move toward the end.
  const exposed = throwAt - times[times.length - 1];
  const maxExposed = cfg.maxExposedBars[phase] * barA;
  if (exposed > maxExposed) times = times.map((t) => t + exposed - maxExposed);
  const slide = rng() < cfg.slide ? beatA : cfg.cutSec;
  const events: PlanEvent[] = [];
  steps.forEach((parts, k) => {
    const dur = Math.min(slide, Math.max(cfg.cutSec, throwAt - times[k] - 0.01));
    for (const part of parts) events.push(removeLane(part, times[k], dur, aStopAt));
  });
  const bedGone = times[times.length - 1] + slide;
  // Mask the stems' artefacts once the bed has gone.
  events.push(set('reverb.return', Math.min(bedGone, throwAt), 1));
  events.push(ramp('A.reverbSend', Math.min(bedGone, throwAt), end, cfg.reverbSend[0], cfg.reverbSend[1], 'lin'));
  events.push(ramp('A.hpf', Math.min(bedGone, throwAt), Math.min(bedGone, throwAt) + 0.05, 20, cfg.hpfHz, 'exp'));
  events.push(
    ...vocalThrow({ throwAt, end, beatA, pickupAt, beatB, rng }),
    ramp('A.gain', end - 0.005, end, A.level, SILENT, 'lin'),
    set('A.reverbSend', end, 0),
    ramp('reverb.return', pickupAt, Math.max(T + 2 * beatB, pickupAt + 0.05), 1, SILENT, 'lin'),
    set('reverb.return', T + 1.5, 1),
  );
  return { events, order: drawn, start, aStopAt };
}

/**
 * A's voice thrown into the echo (Serato's vocal echo, D8's throw): from `throwAt` its vocals lane leaves A's
 * mix and feeds the echo alone, so the dry voice stops and its echo carries on into the gap; the echo fades a
 * beat after B's pickup. A itself must be silent by `end`.
 */
export function vocalThrow({ throwAt, end, beatA, pickupAt, beatB, rng }: {
  throwAt: number; end: number; beatA: number; pickupAt: number; beatB: number; rng: () => number;
}): PlanEvent[] {
  const cfg = MOVES.peel;
  const pre = throwAt - 0.01;
  const edge: LanePoints = [[throwAt - 0.005, 0], [throwAt, 1]];
  return [
    set('echo.time', pre, pick(cfg.throwDelayBeats, rng) * beatA),
    set('echo.feedback', pre, cfg.throwFeedback),
    ramp('echo.hpf', pre, Math.max(pickupAt, pre + 0.05), 250, 1800, 'exp'),
    set('echo.return', pre, 1),
    { kind: 'stemLane', deck: 'A', part: 'vocals', at: pre, until: end + 0.02, direct: edge.map(([t, v]) => [t, -v] as const), echo: edge },
    ramp('echo.return', pickupAt, pickupAt + beatB, 1, SILENT, 'lin'),
    set('echo.feedback', pickupAt + beatB + 0.01, 0),
    set('echo.return', pickupAt + beatB + 0.4, 1),
  ];
}
