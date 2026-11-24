// Layers of the incoming song B that decorate a recipe (docs/dj-techniques.md), pure like the recipes:
//  - D9's Ghost Tease: B's voice only through the reverb behind A's last bars (S1) or the bridge's last bars (S2);
//    with agreeing keys it sometimes becomes a voice in its last beat;
//  - D11's vocal-chop stutter: B's first syllable chopped faster and faster on B's grid (an S2 build, or one beat
//    in an S1 gap);
//  - D5's riff bed: B's approved riff Signature looped on B's grid under R7's bridge;
//  - D19's scratch: B's first syllable scratched back and forth on B's grid, released into the pickup (an S2
//    recipe, or one beat in an S1 gap).
import { MOVES } from '../config.ts';
import type { PhaseName } from '../config.ts';
import { weightedPick } from '../rng.ts';
import { SILENT, dbToGain, pick, ramp, set } from './events.ts';
import type { LanePoints, PlanEvent, ScratchEvent, ScratchStroke, SignatureEvent, Slice, SliceSource, SlicesEvent } from './events.ts';
import { throwEcho } from './moves.ts';
import type { HookGrid } from './timeline.ts';

/** The names of the layers a plan reports. */
export type LayerName = 'ghost' | 'ghostVoice' | 'riff' | 'gapChop' | 'gapScratch';

export interface GhostArgs {
  /** B's landing, its pickup and the gap before it (A is silent, or the build over, from `gapStart`). */
  T: number;
  pickupAt: number;
  gapStart: number;
  gB: HookGrid;
  /** The bar the ghost spans phase{—, 1, 1.5, 2} of: A's at the landing (S1), B's on a bridge (S2). */
  bar: number;
  /** The earliest start: after the spin-start duck (or the bridge's start), and inside B's decoded stems. */
  minStart: number;
  phase: PhaseName;
  rng: () => number;
  /** A's and B's keys are compatible (confidence ≥ LAYERING.minKeyConfidence); unknown counts as not. */
  keysMatch: boolean;
  /** "The ghost becomes a voice": B's dry vocals in its last beat (keys must agree); null draws it. */
  voice?: boolean | null;
}

/**
 * D9: B's vocal stem feeds only the reverb over the last bars before the gap, rising (cubic) until it is cut at
 * the gap, so a rhythm-free cloud of B's voice hides any tempo mismatch and the dry hook bursts out of it. With
 * keys that do not agree it stays air (higher high-pass, lower send); with keys that agree it sometimes becomes a
 * voice: the same lane plays B's dry vocals past B's (still closed) fader in its last beat. The reverb's return
 * drops at the pickup and is out two beats after the landing.
 * @returns null when less than a beat fits
 */
export function ghostLayer({ T, pickupAt, gapStart, gB, bar, minStart, phase, rng, keysMatch, voice = null }: GhostArgs): { events: PlanEvent[]; voice: boolean } | null {
  const cfg = MOVES.ghost;
  const start = Math.max(minStart, gapStart - cfg.bars[phase] * bar);
  if (gapStart - start < gB.beat) return null;
  const send = keysMatch ? cfg.send[phase] : Math.min(cfg.send[phase], cfg.airSend);
  const hpfTo = keysMatch ? pick(cfg.hpfToHz, rng) : cfg.airHpfHz;
  const span = gapStart - start;
  const reverb: LanePoints = [0, 0.25, 0.5, 0.75, 1].map((u) => [start + u * span, send * u ** 3] as const);
  const sings = keysMatch && (voice ?? rng() < cfg.voiceChance);
  const dry = dbToGain(cfg.voiceDb);
  const lastBeat = gapStart - gB.beat;
  const solo: LanePoints | null = sings ? [[lastBeat, 0], [lastBeat + 0.02, dry], [gapStart - 0.01, dry], [gapStart, 0]] : null;
  return {
    voice: sings,
    events: [
      { kind: 'stemLane', deck: 'B', part: 'vocals', at: start, until: gapStart, direct: [[start, 0]], reverb, ...(solo ? { solo } : {}) },
      set('reverb.return', start, 1),
      ramp('reverb.hpf', start, gapStart, cfg.hpfFromHz, hpfTo, 'exp'),
      set('reverb.return', pickupAt, 0.5),
      ramp('reverb.return', pickupAt, Math.max(T + 2 * gB.beat, pickupAt + 0.05), 0.5, SILENT, 'lin'),
      set('reverb.return', T + 2 * gB.beat + 1.2, 1),
      set('reverb.hpf', T + 2 * gB.beat + 1.2, cfg.hpfFromHz),
    ],
  };
}

/** Where D11's (and D19's) grain comes from: B's approved call Signature, or B's vocal stem at its pickup. `offset` is in that source. */
export type ChopSource =
  | { from: 'signature'; id: string; offset: number; gainDb: number }
  | { from: 'stem'; offset: number };

const sourceOf = (source: ChopSource): SliceSource => (source.from === 'signature' ? { from: 'signature', id: source.id } : { from: 'stem', part: 'vocals' });

/** The grain's level: the Phase's Signature level plus the move's, and the call's own normalisation. */
const grainDb = (source: ChopSource, signatureDb: number, moveDb: number): number => signatureDb + moveDb + (source.from === 'signature' ? source.gainDb : 0);

export interface ChopArgs {
  source: ChopSource;
  /** The chops end here (the gap before B's pickup). */
  gapStart: number;
  gB: HookGrid;
  /** Bars of chops: the last one is the pattern, an earlier one plays half notes. */
  bars: number;
  /** Chops never start before this (A's exit downbeat, where the bridge starts). */
  from: number;
  phase: PhaseName;
  /** The Phase's Signature level (PhaseEffects.signatureDb). */
  signatureDb: number;
  rng: () => number;
}

/**
 * The chops as a slices event: each hit [time, step] plays the grain (cut to its step), each one a little higher
 * (rate 1 → phase{1, 1.06, 1.12, 1.19}), a +12 layer doubling the last `octaveFrom` on sometimes; past B's fader,
 * 3 ms fades, high-passed at 150 Hz, snapped to the syllable's onset.
 */
function chopEvent(source: ChopSource, hits: readonly (readonly [number, number])[], grain: number, octaveFrom: number, phase: PhaseName, signatureDb: number, rng: () => number): SlicesEvent {
  const cfg = MOVES.chop;
  const level = dbToGain(grainDb(source, signatureDb, cfg.gainDb[phase]));
  const rateTo = cfg.rateTo[phase];
  const slices: Slice[] = hits.map(([at, step], k) => ({
    at,
    offset: source.offset,
    dur: Math.min(grain, step) - 0.002,
    gain: level,
    rate: 1 + ((rateTo - 1) * k) / Math.max(1, hits.length - 1),
  }));
  if (rng() < cfg.octaveChance) {
    // +12 on the last beat: the same chops an octave up, quieter.
    for (const s of slices.filter((x) => x.at >= octaveFrom - 1e-6)) slices.push({ ...s, rate: 2 * (s.rate ?? 1), gain: s.gain * dbToGain(cfg.octaveDb) });
    slices.sort((x, y) => x.at - y.at);
  }
  return { kind: 'slices', deck: 'B', slices, source: sourceOf(source), direct: true, fadeMs: cfg.fadeMs, hpfHz: cfg.hpfHz, snap: { searchSec: cfg.onsetSearchSec, consonantSec: cfg.consonantSec } };
}

/**
 * D11: the grain (¼ or ⅛ of B's beat from the source's first syllable) on B's grid over the last bar before
 * the gap: beats at ¼ notes, the next-to-last beat at ⅛, the last at 1/16 then 1/32; a bar of half notes before
 * it when there are two.
 */
export function chopSlices({ source, gapStart, gB, bars, from, phase, signatureDb, rng }: ChopArgs): SlicesEvent | null {
  const grain = pick(MOVES.chop.grainBeats, rng) * gB.beat;
  const last = gapStart - gB.bar;
  // [time, step] of every chop, on B's grid.
  const hits: [number, number][] = [];
  if (bars >= 2) for (let k = 0; k < gB.bpb; k += 2) hits.push([last - gB.bar + k * gB.beat, 2 * gB.beat]);
  for (let k = 0; k < gB.bpb; k++) {
    const beat = last + k * gB.beat;
    if (k < gB.bpb - 2) hits.push([beat, gB.beat]);
    else if (k === gB.bpb - 2) hits.push([beat, gB.beat / 2], [beat + gB.beat / 2, gB.beat / 2]);
    else {
      for (let j = 0; j < 2; j++) hits.push([beat + (j * gB.beat) / 4, gB.beat / 4]);
      for (let j = 0; j < 4; j++) hits.push([beat + gB.beat / 2 + (j * gB.beat) / 8, gB.beat / 8]);
    }
  }
  const kept = hits.filter(([t]) => t >= from - 1e-6);
  if (kept.length < 4) return null;
  return chopEvent(source, kept, grain, last + (gB.bpb - 1) * gB.beat, phase, signatureDb, rng);
}

/**
 * D11 in an S1 gap: one beat of chops right before B's pickup, in the silence after A (⅛ notes, then 1/16, then
 * 1/32: "ca-ca-ca-ca-CARAMEL"), the full word on the pickup. The gap must be at least a beat; in a longer one the
 * first beats stay silent.
 */
export function gapChopSlices({ source, pickupAt, gB, phase, signatureDb, rng }: {
  source: ChopSource; pickupAt: number; gB: HookGrid; phase: PhaseName; signatureDb: number; rng: () => number;
}): SlicesEvent {
  const b = gB.beat;
  const start = pickupAt - b;
  const hits: [number, number][] = [[start, b / 4], [start + b / 4, b / 4]];
  for (let j = 0; j < 2; j++) hits.push([start + b / 2 + (j * b) / 8, b / 8]);
  for (let j = 0; j < 4; j++) hits.push([start + (3 * b) / 4 + (j * b) / 16, b / 16]);
  const grain = pick(MOVES.chop.grainBeats, rng) * b;
  return chopEvent(source, hits, grain, start + b / 2, phase, signatureDb, rng);
}

// ------------------------------------------------------------------------------------------ D5 riff bed
/** An approved riff Signature of B that can loop on B's grid (planner riffSource). */
export interface RiffSource {
  id: string;
  /** Where its first downbeat is in its file, and the file's length. */
  anchorSec: number;
  durationSec: number;
  /** Its length in B's bars (one loop). */
  bars: number;
  /** The resample onto B's grid at its hook (within SIGNATURES.maxRateShift). */
  rate: number;
  gainDb: number;
}

export const RIFF_VARIANTS = ['dry', 'throw', 'gate'] as const;
export type RiffVariant = (typeof RIFF_VARIANTS)[number];

export interface RiffArgs {
  riff: RiffSource;
  /** The bridge's start (a bar line of B) and the gap before B's pickup. */
  e: number;
  T: number;
  gapStart: number;
  pickupAt: number;
  gB: HookGrid;
  phase: PhaseName;
  signatureDb: number;
  rng: () => number;
  variant?: RiffVariant | null;
}

/**
 * D5: B's riff loops on B's grid under the bridge, anchored so a loop ends on B's hook downbeat (its phrase end
 * meets the landing), from the bridge's start (the first loop comes in mid-riff when the bridge is not a whole
 * number of loops) to the gap, where it is cut in 10 ms. Seams are 5 ms. Variants: dry; its last beat thrown into
 * the echo; its last bar chopped by a gate in eighths of a beat (P2 slices of the riff's file).
 * @returns null when the bridge is too short for it
 */
export function riffBed({ riff, e, T, gapStart, pickupAt, gB, phase, signatureDb, rng, variant = null }: RiffArgs): { events: PlanEvent[]; variant: RiffVariant } | null {
  const cfg = MOVES.riff;
  if (gapStart - e < cfg.minBars * gB.bar - 1e-6) return null;
  const loop = riff.bars * gB.bar;
  const kind: RiffVariant = variant ?? weightedPick(cfg.variants, rng) ?? 'dry';
  const level = riff.gainDb + signatureDb + cfg.gainDb[phase];
  // Where the plain loops stop: the gap, or where the variant takes over.
  const cut = kind === 'throw' ? gapStart - gB.beat : kind === 'gate' ? Math.max(e, gapStart - gB.bar) : gapStart;
  /** The loop sounding at `t`: its anchor (a bar line, T − k·loop). */
  const anchorOf = (t: number) => T - Math.ceil((T - t) / loop - 1e-9) * loop;
  /** The file seconds sounding at `t`. */
  const fileAt = (t: number) => riff.anchorSec + (t - anchorOf(t)) * riff.rate;
  const playable = (riff.durationSec - riff.anchorSec) / riff.rate;
  const sig = (at: number, from: number, until: number, fadeSec: number, echo = 0): SignatureEvent =>
    ({ kind: 'signature', deck: 'B', id: riff.id, at, anchorSec: riff.anchorSec, rate: riff.rate, gainDb: level, until, echo, from, fadeSec });
  const events: PlanEvent[] = [];
  for (let at = anchorOf(e); at < cut - 1e-6; at += loop) {
    const from = Math.max(e, at);
    const until = Math.min(at + loop, cut, at + playable);
    if (until - from < 0.05) continue;
    events.push(sig(at, from, until, until >= gapStart - 1e-6 ? cfg.endFadeSec : cfg.seamFadeSec));
  }
  if (kind === 'throw' && cut > e) {
    // The last beat alone into the echo, which rings into the gap and fades after the pickup.
    const at = anchorOf(cut + 1e-6);
    events.push(sig(at, cut, Math.min(gapStart, at + playable), cfg.endFadeSec, cfg.throwSend));
    events.push(...throwEcho({ pre: cut - 0.01, delay: pick(cfg.throwDelayBeats, rng) * gB.beat, feedback: cfg.throwFeedback, pickupAt, beatB: gB.beat }));
  } else if (kind === 'gate') {
    const step = cfg.gateStepBeats * gB.beat;
    const slices: Slice[] = [];
    for (let t = cut; t < gapStart - 1e-6; t += step) {
      if (fileAt(t) + cfg.gateDuty * step * riff.rate > riff.durationSec) continue;
      slices.push({ at: t, offset: fileAt(t), dur: cfg.gateDuty * step, gain: dbToGain(level), rate: riff.rate });
    }
    if (slices.length) events.push({ kind: 'slices', deck: 'B', slices, source: { from: 'signature', id: riff.id }, direct: true, fadeMs: 2 });
  }
  return events.length ? { events, variant: kind } : null;
}

// ------------------------------------------------------------------------------------------ D19 scratch
export const SCRATCH_STYLES = ['baby', 'chirp', 'forward'] as const;
export type ScratchStyle = (typeof SCRATCH_STYLES)[number];

export interface ScratchArgs {
  source: ChopSource;
  pickupAt: number;
  /** The scratch never starts before this (the bridge's start, or the gap's). */
  from: number;
  /** How many of B's beats it lasts at most (the last half beat is the release). */
  beats: number;
  gB: HookGrid;
  phase: PhaseName;
  signatureDb: number;
  rng: () => number;
  style?: ScratchStyle | null;
}

/**
 * D19: B's first syllable scratched on B's grid. Every eighth note is a stroke: the hand pushes the record through
 * the grain (¼ of the eighth, eased like a hand) and pulls it back. Baby scratches are heard both ways, chirps cut
 * the crossfader shut halfway through each push, forward scratches only sound on the pushes. The last eighth is
 * the release: the record runs forward at full speed and is cut a breath before the pickup, where the whole word
 * comes in with the song.
 * @returns null when less than a beat fits
 */
export function scratchMove({ source, pickupAt, from, beats, gB, phase, signatureDb, rng, style = null }: ScratchArgs): { event: ScratchEvent; style: ScratchStyle; beats: number } | null {
  const cfg = MOVES.scratch;
  const half = gB.beat / 2;
  const eighths = Math.min(2 * beats, Math.floor((pickupAt - from) / half + 1e-6));
  if (eighths < 2) return null;
  const drawn: ScratchStyle = style ?? weightedPick(cfg.styles, rng) ?? 'baby';
  const grain = pick(cfg.grainBeats, rng) * gB.beat;
  const start = pickupAt - eighths * half;
  const end = pickupAt - cfg.breathSec;
  const edge = cfg.edgeSec;
  const strokes: ScratchStroke[] = [];
  const gate: [number, number][] = [[start, 0]];
  for (let k = 0; k < eighths - 1; k++) {
    const t = start + k * half;
    const mid = t + half / 2;
    strokes.push({ t0: t, t1: mid, p0: 0, p1: grain, ease: true }, { t0: mid, t1: t + half, p0: grain, p1: 0, ease: true });
    // The crossfader for this stroke: open on the push (to its middle for a chirp), and on the pull for a baby.
    const pushEnd = drawn === 'chirp' ? t + half / 4 : mid;
    gate.push([t + edge, 1]);
    if (drawn === 'baby') continue;
    gate.push([pushEnd - edge, 1], [pushEnd, 0], [t + half - edge, 0]);
  }
  // The release: forward at full speed from the grain's start, cut a breath before the pickup.
  const release = start + (eighths - 1) * half;
  strokes.push({ t0: release, t1: end, p0: 0, p1: end - release, ease: false });
  gate.push([release, 1], [end - edge, 1], [end, 0]);
  const level = grainDb(source, signatureDb, cfg.gainDb[phase]);
  return {
    style: drawn,
    beats: eighths / 2,
    event: {
      kind: 'scratch', deck: 'B', at: start, until: end + 0.002, source: sourceOf(source), offset: source.offset, strokes, gate, gainDb: level,
      hpfHz: cfg.hpfHz, snap: { searchSec: MOVES.chop.onsetSearchSec, consonantSec: MOVES.chop.consonantSec },
    },
  };
}
