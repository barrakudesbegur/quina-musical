// Moves of the outgoing deck A that recipes and exits share (docs/dj-techniques.md): D1's gate and pump,
// D3's spiral echo, D2's stop-time stabs, D8's stem peel, D7's pitch-up rush and D15's instrumental braker. Each
// is pure and returns plan events; each works on A's own grid (its beats before the landing downbeat) and leaves
// A silent at `end`.
import { MOVES } from '../config.ts';
import type { PhaseName } from '../config.ts';
import { weightedPick } from '../rng.ts';
import { OPEN_LPF, SILENT, dbToGain, pick, ramp, set, sfx, synth } from './events.ts';
import type { LanePart, LanePoints, PlanEvent, StemLaneEvent } from './events.ts';
import { rampTimeAt } from './rate.ts';
import type { RateRamp } from './rate.ts';
import type { Timeline } from './timeline.ts';

/** Per-bar RMS of a song's stems (data/stems `bars`, dB), by downbeat index. */
export type StemBars = Readonly<Partial<Record<LanePart, readonly number[]>>>;

/**
 * The outgoing deck as recipes see it: its timeline, its level after the spin-start duck, its stems' bar levels,
 * and its playback rate (1 when left out).
 */
export interface OutgoingDeck {
  tl: Timeline;
  level: number;
  bars?: StemBars | null;
  rate?: number;
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

/** The mean level (dB) of a part of A over the `bars` bars before downbeat `i`; null when unknown. */
function barsLevel(A: OutgoingDeck, part: LanePart, i: number, bars: number): { mean: number; max: number; median: number } | null {
  const levels = A.bars?.[part];
  if (!levels?.length) return null;
  const span = levels.slice(Math.max(0, i - bars), i);
  if (!span.length) return null;
  return { mean: span.reduce((a, b) => a + b, 0) / span.length, max: Math.max(...span), median: median(levels) };
}

/** True when A's drums in the bars before downbeat `i` are far under the song's median (a gate would sound like dropouts). */
export function sparseDrums(A: OutgoingDeck, i: number, bars: number): boolean {
  const drums = barsLevel(A, 'drums', i, bars);
  return drums != null && drums.mean < drums.median + MOVES.gate.sparseDrumsDb;
}

/** True when A sings in the bars before downbeat `i` (D15 needs a voice to keep); unknown counts as singing. */
export function singsBefore(A: OutgoingDeck, i: number, bars: number, minDb: number): boolean {
  const vocals = barsLevel(A, 'vocals', i, bars);
  return vocals == null || vocals.max >= minDb;
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
  /**
   * Where a time of A's grid sounds: identity, unless A's tape speeds up under the gate (D7's rush), so every
   * step still opens on one of A's beats as it arrives.
   */
  timeMap?: (t: number) => number;
}

/**
 * D1: A chopped in time over `bars` of its bars ending at `end` (a Pioneer Trans gate with a 1/16 or
 * 1/32 ladder), or pumped on every beat like a sidechain with kicks, or both. Every edge is a 2 ms ramp;
 * A's high-pass is above 250 Hz before the fast stages; A is silent at `end`.
 */
export function gateMove({ A, i, end, bars, phase, rng, mode = null, exit = false, timeMap = (t) => t }: GateArgs): { events: PlanEvent[]; mode: GateMode; start: number } {
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
    const closedDb = exit ? -24 : cfg.closedDb[phase];
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
        const at = timeMap(t + j * step);
        const off = timeMap(t + j * step + duty * step);
        if (tresillo && stepBeats === 0.25 && ![0, 3, 6].includes(j % 8)) continue;
        events.push(ramp('A.gain', at, at + edge, level, open, 'lin'));
        events.push(ramp('A.gain', off - edge, off, open, closed, 'lin'));
        level = closed;
      }
      t += count * step;
    }
    if (closed > SILENT) events.push(ramp('A.gain', timeMap(end) - edge, timeMap(end), closed, SILENT, 'lin'));
  }
  if (drawn !== 'gate') {
    // The pump's kicks on every beat (louder as it goes); the pump itself only when the gate is off.
    const beats = Math.round(bars * bpb);
    for (let j = 0; j < beats; j++) {
      const at = timeMap(start + j * beatA);
      const u = beats > 1 ? j / (beats - 1) : 1;
      events.push(synth('kicks', { times: [at], level: cfg.kicks[0] + (cfg.kicks[1] - cfg.kicks[0]) * u }));
      if (drawn !== 'pump') continue;
      const deep = A.level * dbToGain(cfg.pumpDb[0] + (cfg.pumpDb[1] - cfg.pumpDb[0]) * u);
      const sub = j === beats - 1 ? 2 : 1; // the last beat pumps in eighths
      for (let s = 0; s < sub; s++) {
        const p = timeMap(start + j * beatA + (s * beatA) / sub);
        const back = timeMap(start + j * beatA + ((s + cfg.pumpRecoverBeats) * beatA) / sub);
        events.push(ramp('A.gain', p, p + 0.005, A.level, deep, 'lin'));
        events.push(ramp('A.gain', p + 0.005, back, deep, A.level, 'exp'));
      }
    }
    if (drawn === 'pump') events.push(ramp('A.gain', timeMap(end) - 0.004, timeMap(end), A.level, SILENT, 'lin'));
  }
  const mappedEnd = timeMap(end);
  if (fastAt != null && fastAt > start + 0.01) {
    events.push(ramp('A.hpf', start, timeMap(fastAt), 20, cfg.fastStageHpfHz, 'exp'));
    events.push(ramp('A.hpf', timeMap(fastAt), mappedEnd, cfg.fastStageHpfHz, Math.max(hpfTo, cfg.fastStageHpfHz), 'exp'));
  } else {
    events.push(ramp('A.hpf', start, mappedEnd, 20, hpfTo, 'exp'));
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
  // The ring is out just before the pickup (the stabs end at least 20 ms before the gap).
  const ringEnd = Math.max(last + length + 0.01, pickupAt - 0.01);
  events.push(ramp('reverb.return', Math.min(last + length, ringEnd - 0.01), ringEnd, 1, SILENT, 'lin'));
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
    ...throwEcho({ pre, delay: pick(cfg.throwDelayBeats, rng) * beatA, feedback: cfg.throwFeedback, pickupAt, beatB }),
    { kind: 'stemLane', deck: 'A', part: 'vocals', at: pre, until: end + 0.02, direct: edge.map(([t, v]) => [t, -v] as const), echo: edge },
  ];
}

/** The echo set for a throw from `pre`: tempo-synced, high-pass climbing, faded a beat after B's pickup and flushed. */
export function throwEcho({ pre, delay, feedback, pickupAt, beatB }: { pre: number; delay: number; feedback: number; pickupAt: number; beatB: number }): PlanEvent[] {
  return [
    set('echo.time', pre, delay),
    set('echo.feedback', pre, feedback),
    ramp('echo.hpf', pre, Math.max(pickupAt, pre + 0.05), 250, 1800, 'exp'),
    set('echo.return', pre, 1),
    ramp('echo.return', pickupAt, pickupAt + beatB, 1, SILENT, 'lin'),
    set('echo.feedback', pickupAt + beatB + 0.01, 0),
    set('echo.return', pickupAt + beatB + 0.4, 1),
  ];
}

// ------------------------------------------------------------------------------------ D7 pitch-up rush
export interface RushArgs {
  A: OutgoingDeck;
  i: number;
  end: number;
  bars: number;
  phase: PhaseName;
  rng: () => number;
  /** A D1 gate on top (late); null draws it with the Phase's chance. */
  gate?: boolean | null;
}

/**
 * D7: A becomes the riser. Its tape speed climbs exponentially over its last `bars` bars (most of the rise in the
 * last beat) by 3–5 semitones, a semitone less when its singer is loud there (no chipmunks); its high-pass opens,
 * it lifts a dB, and it is cut 30 ms before `end`. A runs ahead of its grid, so the planner keeps a gap of at
 * least half a beat. Late, a D1 gate may chop it instead, each step on one of A's beats as the tape brings it.
 */
export function rushMove({ A, i, end, bars, phase, rng, gate = null }: RushArgs): { events: PlanEvent[]; start: number; semitones: number; gated: boolean } {
  const cfg = MOVES.rush;
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const start = end - bars * barA;
  const rate0 = A.rate ?? 1;
  const vocals = barsLevel(A, 'vocals', i, bars);
  const loud = vocals != null && vocals.mean > vocals.median + cfg.loudVocalsDb;
  const semitones = Math.max(2, Math.min(cfg.maxSemitones, cfg.semitones[phase] + Math.round(rng() * 2 - 1) - (loud ? 1 : 0)));
  const rampEnd = end - cfg.cutSec;
  const tape: RateRamp = { t0: start, t1: rampEnd, from: rate0, to: rate0 * 2 ** (semitones / 12), curve: 'exp' };
  const gated = gate ?? rng() < cfg.gateChance[phase];
  const events: PlanEvent[] = [ramp('A.rate', tape.t0, tape.t1, tape.from, tape.to, 'exp')];
  if (gated) {
    // A grid time τ sounds once the climbing tape has played (τ − start)·rate0 song seconds.
    const timeMap = (t: number) => (t <= start ? t : rampTimeAt(tape, (t - start) * rate0));
    events.push(...gateMove({ A, i, end, bars, phase, rng, mode: 'gate', timeMap }).events);
  } else {
    const lifted = A.level * dbToGain(cfg.liftDb);
    events.push(
      ramp('A.hpf', start, end, 20, pick(cfg.hpfToHz, rng), 'exp'),
      ramp('A.gain', start, start + beatA, A.level, lifted, 'lin'),
      ramp('A.gain', end - cfg.cutSec, end, lifted, SILENT, 'lin'),
    );
  }
  events.push(synth('riser', { t0: start, t1: end, fromHz: 800, toHz: 9000, fromDb: -36, toDb: cfg.riserDb[phase], tone: true }));
  return { events, start, semitones, gated };
}

// ------------------------------------------------------------------------------ D15 instrumental braker
export interface BrakerArgs {
  A: OutgoingDeck;
  i: number;
  end: number;
  pickupAt: number;
  beatB: number;
  rng: () => number;
}

/**
 * D15: over A's last bar its band brakes to a halt (the rate to 0.02 and the low-pass closing, as EXITS.brake)
 * while its singer carries on, dry and at speed: a −vocals lane braking with the band (the same rate automation,
 * so it still cancels the voice inside the braking mix) and a vocals lane past the fader at rate 1. Half a beat
 * before `end` the voice goes into the echo alone (the throw), which rings into the gap.
 */
export function brakerMove({ A, i, end, pickupAt, beatB, rng }: BrakerArgs): { events: PlanEvent[]; start: number; brakeSec: number; aStopAt: number } {
  const cfg = MOVES.braker;
  const barA = A.tl.barAt(i);
  const beatA = A.tl.beatAt(i);
  const start = end - barA;
  const brakeSec = pick(cfg.brakeBars, rng) * barA;
  const stopAt = start + brakeSec;
  const rate: RateRamp = { t0: start, t1: stopAt, from: A.rate ?? 1, to: cfg.rateTo, curve: 'lin' };
  const throwAt = end - cfg.throwBeats * beatA;
  const fade = 0.005;
  const aStopAt = end + 0.05;
  const events: PlanEvent[] = [
    // The band brakes.
    ramp('A.rate', rate.t0, rate.t1, rate.from, rate.to, 'lin'),
    ramp('A.lpf', start, stopAt, OPEN_LPF, cfg.lpfToHz, 'exp'),
    ramp('A.gain', stopAt - 0.12, stopAt, A.level, SILENT, 'lin'),
    synth('downlifter', { t0: start, t1: stopAt + 0.2, peakDb: -16 }),
    // Its voice leaves the braking mix (a −lane braking with it) ...
    { kind: 'stemLane', deck: 'A', part: 'vocals', at: start, until: stopAt + 0.01, direct: [[start, 0], [start + fade, -1]], rate },
    // ... and carries on dry past the fader, at A's level, until it is thrown into the echo.
    {
      kind: 'stemLane', deck: 'A', part: 'vocals', at: start, until: end + 0.02, direct: [[start, 0]],
      solo: [[start, 0], [start + fade, A.level], [throwAt - fade, A.level], [throwAt, 0]],
      echo: [[throwAt - fade, 0], [throwAt, 1]],
    },
    ...throwEcho({ pre: throwAt - 0.01, delay: pick(cfg.throwDelayBeats, rng) * beatA, feedback: cfg.throwFeedback, pickupAt, beatB }),
  ];
  return { events, start, brakeSec, aStopAt };
}
