// Layers of the incoming song B that decorate a recipe (docs/dj-techniques.md): D9's Ghost Tease, B's voice
// only through the reverb behind A's last bars, and D11's vocal-chop stutter, B's first syllable chopped
// faster and faster on B's grid. Pure, like the recipes.
import { MOVES } from '../config.ts';
import type { PhaseName } from '../config.ts';
import { SILENT, dbToGain, pick, ramp, set } from './events.ts';
import type { LanePoints, PlanEvent, Slice, SliceSource, SlicesEvent } from './events.ts';
import type { HookGrid } from './timeline.ts';

/** The names of the layers a plan reports. */
export type LayerName = 'ghost';

export interface GhostArgs {
  /** B's landing, its pickup and the gap before it (A is silent from `gapStart`). */
  T: number;
  pickupAt: number;
  gapStart: number;
  gB: HookGrid;
  /** A's bar at the landing: the ghost spans phase{—, 1, 1.5, 2} of them. */
  barA: number;
  /** The earliest start: after the spin-start duck, and inside B's decoded stems. */
  minStart: number;
  phase: PhaseName;
  rng: () => number;
  /** A's and B's keys are compatible (confidence ≥ LAYERING.minKeyConfidence); unknown counts as not. */
  keysMatch: boolean;
}

/**
 * D9: B's vocal stem feeds only the reverb over A's last bars, rising (cubic) until it is cut at the gap, so a
 * rhythm-free cloud of B's voice hides any tempo mismatch and the dry hook bursts out of it. With keys that do
 * not agree it stays air (higher high-pass, lower send). The reverb's return drops at the pickup and is out
 * two beats after the landing.
 * @returns null when less than a beat fits
 */
export function ghostLayer({ T, pickupAt, gapStart, gB, barA, minStart, phase, rng, keysMatch }: GhostArgs): PlanEvent[] | null {
  const cfg = MOVES.ghost;
  const start = Math.max(minStart, gapStart - cfg.bars[phase] * barA);
  if (gapStart - start < gB.beat) return null;
  const send = keysMatch ? cfg.send[phase] : Math.min(cfg.send[phase], cfg.airSend);
  const hpfTo = keysMatch ? pick(cfg.hpfToHz, rng) : cfg.airHpfHz;
  const span = gapStart - start;
  const reverb: LanePoints = [0, 0.25, 0.5, 0.75, 1].map((u) => [start + u * span, send * u ** 3] as const);
  return [
    { kind: 'stemLane', deck: 'B', part: 'vocals', at: start, until: gapStart, direct: [[start, 0]], reverb },
    set('reverb.return', start, 1),
    ramp('reverb.hpf', start, gapStart, cfg.hpfFromHz, hpfTo, 'exp'),
    set('reverb.return', pickupAt, 0.5),
    ramp('reverb.return', pickupAt, Math.max(T + 2 * gB.beat, pickupAt + 0.05), 0.5, SILENT, 'lin'),
    set('reverb.return', T + 2 * gB.beat + 1.2, 1),
    set('reverb.hpf', T + 2 * gB.beat + 1.2, cfg.hpfFromHz),
  ];
}

/** Where D11's grain comes from: B's approved call Signature, or B's vocal stem at its pickup. `offset` is in that source. */
export type ChopSource =
  | { from: 'signature'; id: string; offset: number; gainDb: number }
  | { from: 'stem'; offset: number };

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
 * D11: the grain (¼ or ⅛ of B's beat from the source's first syllable) on B's grid over the last bar before
 * the gap: beats at ¼ notes, the next-to-last beat at ⅛, the last at 1/16 then 1/32; a bar of half notes before
 * it when there are two. Each chop is pitched a little higher (rate 1 → phase{1, 1.06, 1.12, 1.19}); a +12
 * layer doubles the last beat sometimes. Played past B's fader, 3 ms fades, high-passed at 150 Hz, snapped to
 * the syllable's onset.
 */
export function chopSlices({ source, gapStart, gB, bars, from, phase, signatureDb, rng }: ChopArgs): SlicesEvent | null {
  const cfg = MOVES.chop;
  const grain = pick(cfg.grainBeats, rng) * gB.beat;
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
  const level = dbToGain(signatureDb + cfg.gainDb[phase] + (source.from === 'signature' ? source.gainDb : 0));
  const rateTo = cfg.rateTo[phase];
  const slices: Slice[] = kept.map(([at, step], k) => ({
    at,
    offset: source.offset,
    dur: Math.min(grain, step) - 0.002,
    gain: level,
    rate: 1 + ((rateTo - 1) * k) / Math.max(1, kept.length - 1),
  }));
  if (rng() < cfg.octaveChance) {
    // +12 on the last beat: the same chops an octave up, quieter.
    const lastBeat = last + (gB.bpb - 1) * gB.beat;
    for (const s of slices.filter((x) => x.at >= lastBeat - 1e-6)) slices.push({ ...s, rate: 2 * (s.rate ?? 1), gain: s.gain * dbToGain(cfg.octaveDb) });
    slices.sort((x, y) => x.at - y.at);
  }
  const src: SliceSource = source.from === 'signature' ? { from: 'signature', id: source.id } : { from: 'stem', part: 'vocals' };
  return { kind: 'slices', deck: 'B', slices, source: src, direct: true, fadeMs: cfg.fadeMs, hpfHz: cfg.hpfHz, snap: { searchSec: cfg.onsetSearchSec, consonantSec: cfg.consonantSec } };
}
