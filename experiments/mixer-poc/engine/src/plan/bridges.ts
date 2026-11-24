// The build over an S2 bridge [t0, gapStart] on B's grid, so every hit is phase-locked to B's hook. R7's
// bridge pattern is drawn independently of its exit (docs/dj-techniques.md › R7, D4, D13):
//  - roll: noise riser, accelerating snare roll, reverse cymbal into the gap, the music-bus high-pass
//    sweeping up in the last bar (off at the landing); it varies its riser, its first stage and its last beat;
//  - halftime (D4): heavy half-time bars (kick on 1, snare on 3), straight time, then the roll;
//  - kickroll: kicks at ¼ → ⅛ → 1/16, quieter at each stage (a high-passed kick roll), under the riser;
//  - clap (D13, P4 claps): a clap-along on 2 and 4 the room can join, every beat in the last bar, a short roll.
import { MOVES, VARIETY } from '../config.ts';
import type { PhaseEffects } from '../config.ts';
import { weightedPick } from '../rng.ts';
import { pick, ramp, set, synth } from './events.ts';
import type { PlanEvent } from './events.ts';
import { swellLayer } from './landing.ts';
import type { Landing } from './landing.ts';
import type { HookGrid } from './timeline.ts';
import { freshWeights } from './variety.ts';
import type { Recent } from './variety.ts';

export const BRIDGE_PATTERNS = ['roll', 'halftime', 'kickroll', 'clap'] as const;
export type BridgePattern = (typeof BRIDGE_PATTERNS)[number];

/** Patterns that need at least two of B's bars. */
const NEEDS_TWO_BARS: ReadonlySet<BridgePattern> = new Set(['halftime', 'clap']);

export interface BridgeArgs {
  t0: number;
  gapStart: number;
  pickupAt: number;
  gB: HookGrid;
  phase: PhaseEffects;
  /** Without one, the classic build exactly as before (Suspense, R10). */
  rng?: (() => number) | null;
  roll?: boolean;
  landing?: Landing | null;
  /** Scales the snare roll's velocity (D11 lowers it under the chops). */
  rollScale?: number;
}

const loudness = (phase: PhaseEffects): number => ({ early: -12, mid: -9, late: -7, final: -5 })[phase.name] ?? -9;

/** A pattern that needs two bars plays only on a build of at least this many of B's bars (up to the gap). */
const TWO_BARS_MIN = 1.5;

/**
 * The bridge pattern for a build of `bars` of B's bars (from the bridge's start to the gap), the patterns of the
 * last builds (`recent`, newest last) turned down. A forced pattern that does not fit falls back to the roll.
 */
export function chooseBridge(phase: PhaseEffects, bars: number, rng: () => number, force: BridgePattern | null = null, recent: Recent<string> = []): BridgePattern {
  const fits = (p: BridgePattern) => bars >= TWO_BARS_MIN || !NEEDS_TWO_BARS.has(p);
  if (force) return fits(force) ? force : 'roll';
  const weights = { ...MOVES.bridges.weights[phase.name] };
  for (const p of NEEDS_TWO_BARS) if (!fits(p)) weights[p] = 0;
  return weightedPick(freshWeights<BridgePattern>(weights, recent, VARIETY.bridge), rng) ?? 'roll';
}

/** The music bus's high-pass over the last bar into the gap, reset just before the pickup. */
function busSweep(t0: number, gapStart: number, pickupAt: number, gB: HookGrid, toHz = 380): PlanEvent[] {
  return [ramp('bus.hpf', Math.max(t0, gapStart - gB.bar), gapStart, 10, toHz, 'exp'), set('bus.hpf', pickupAt - 0.002, 10)];
}

/**
 * The classic build. With `rng` it varies (MOVES.bridges): a tone riser, the roll starting at ⅛, sextuplets in
 * its last stage (late and final).
 * @returns empty when the bridge is shorter than 0.3 s
 */
export function buildLayers({ t0, gapStart, pickupAt, gB, phase, roll = true, rng = null, landing = null, rollScale = 1 }: BridgeArgs): PlanEvent[] {
  const span = gapStart - t0;
  const events: PlanEvent[] = [];
  if (span < 0.3) return events;
  const loud = loudness(phase);
  const cfg = MOVES.bridges;
  const tone = rng ? rng() < cfg.toneRiser : undefined;
  events.push(synth('riser', { t0, t1: gapStart, fromHz: 700, toHz: 9500, fromDb: loud - 24, toDb: loud, ...(tone === undefined ? {} : { tone }) }));
  if (roll) {
    const beats = span / gB.beat;
    let stages = beats >= 6 ? [1, 0.5, 0.25, 0.125] : beats >= 3 ? [0.5, 0.25, 0.125] : [0.25, 0.125];
    if (rng && stages.length === 4 && rng() < cfg.eighthStart) stages = [0.5, 0.25, 0.125];
    if (rng && (phase.name === 'late' || phase.name === 'final') && rng() < cfg.tripletEnd) stages = [...stages.slice(0, -1), 1 / 6];
    events.push(synth('snareRoll', { t0, t1: gapStart, beat: gB.beat, pitchTo: phase.snarePitch ?? 5, stages, velFrom: 50 * rollScale, velTo: 122 * rollScale }));
  }
  events.push(...swellLayer(landing, Math.max(t0, gapStart - 2 * gB.beat), gapStart, loud - 2));
  events.push(...busSweep(t0, gapStart, pickupAt, gB));
  return events;
}

/** The build for a pattern; falls back to the classic roll when the bridge is too short for it. */
export function bridgeLayers(args: BridgeArgs & { pattern: BridgePattern; rng: () => number }): PlanEvent[] {
  // Under a riff bed (D5) the rolls step back (`rollScale`) whatever the pattern.
  const { pattern, t0, gapStart, gB } = args;
  const lastBar = gapStart - gB.bar; // the bar before the gap (its end is the gap)
  const bars = (gapStart - t0) / gB.bar;
  if (pattern === 'roll' || (NEEDS_TWO_BARS.has(pattern) && bars < TWO_BARS_MIN) || gapStart - t0 < 0.3) return buildLayers(args);
  switch (pattern) {
    case 'halftime':
      return halfTime(args, lastBar);
    case 'kickroll':
      return kickRoll(args);
    case 'clap':
      return clapAlong(args, lastBar);
  }
}

/** D4: heavy half-time bars, straight time, then the roll in the last bar. */
function halfTime({ t0, gapStart, pickupAt, gB, phase, rng, landing = null, rollScale = 1 }: BridgeArgs & { rng: () => number }, lastBar: number): PlanEvent[] {
  const loud = loudness(phase);
  const kick = MOVES.bridges.kicks;
  const fullBars = Math.max(1, Math.floor((lastBar - t0) / gB.bar + 1e-6));
  const h = pick([1, Math.max(1, Math.floor(fullBars / 2))], rng);
  const halfEnd = t0 + h * gB.bar;
  const events: PlanEvent[] = [
    synth('riser', { t0, t1: gapStart, fromHz: 600, toHz: 9500, fromDb: -36, toDb: loud }),
    synth('downlifter', { t0, t1: t0 + gB.bar, peakDb: -18 }),
  ];
  const kicks: number[] = [];
  const offbeat = rng() < 0.5;
  for (let b = t0; b < halfEnd - 1e-6; b += gB.bar) {
    kicks.push(b);
    if (offbeat) kicks.push(b + 1.5 * gB.beat);
  }
  events.push(synth('kicks', { times: kicks, level: kick }));
  // One snare per bar, on its third beat.
  events.push(synth('snareRoll', { t0: t0 + 2 * gB.beat, t1: halfEnd, beat: gB.beat, pitchTo: 0, stages: [gB.bpb], velFrom: 100 * rollScale, velTo: 110 * rollScale }));
  if (lastBar - halfEnd > gB.beat - 1e-6) {
    // Double time arrives: a snare and a kick on every beat.
    const straight: number[] = [];
    for (let b = halfEnd; b < lastBar - 1e-6; b += gB.beat) straight.push(b);
    events.push(synth('snareRoll', { t0: halfEnd, t1: lastBar, beat: gB.beat, pitchTo: 1, stages: [1], velFrom: 80 * rollScale, velTo: 100 * rollScale }));
    events.push(synth('kicks', { times: straight, level: kick }));
  }
  const rollFrom = Math.max(halfEnd, lastBar);
  events.push(synth('snareRoll', { t0: rollFrom, t1: gapStart, beat: gB.beat, pitchTo: phase.snarePitch ?? 5, stages: [0.5, 0.25, 0.125], velFrom: 90 * rollScale, velTo: 124 * rollScale }));
  events.push(...swellLayer(landing, Math.max(t0, gapStart - 2 * gB.beat), gapStart, loud - 2));
  events.push(...busSweep(t0, gapStart, pickupAt, gB));
  return events;
}

/** A kick roll: ¼, ⅛, then 1/16 notes, each stage quieter (it high-passes itself as it speeds up). */
function kickRoll({ t0, gapStart, pickupAt, gB, phase, landing = null }: BridgeArgs): PlanEvent[] {
  const loud = loudness(phase);
  const span = gapStart - t0;
  const stages: [number, number, number][] = [[0, 0.5, 1], [0.5, 0.75, 0.5], [0.75, 1, 0.25]]; // [from, to] share of the span, step in beats
  const levels = [MOVES.bridges.kicks, 0.48, 0.38];
  const events: PlanEvent[] = [synth('riser', { t0, t1: gapStart, fromHz: 700, toHz: 9500, fromDb: loud - 24, toDb: loud, tone: true })];
  stages.forEach(([from, to, step], k) => {
    const times: number[] = [];
    // Snap each stage to B's beat grid from t0 (t0 is a bar line of B).
    const start = t0 + Math.round((from * span) / gB.beat) * gB.beat;
    const end = k === stages.length - 1 ? gapStart : t0 + Math.round((to * span) / gB.beat) * gB.beat;
    for (let t = start; t < end - 1e-6; t += step * gB.beat) times.push(t);
    if (times.length) events.push(synth('kicks', { times, level: levels[k] }));
  });
  events.push(...swellLayer(landing, Math.max(t0, gapStart - 2 * gB.beat), gapStart, loud - 2));
  events.push(...busSweep(t0, gapStart, pickupAt, gB));
  return events;
}

/** D13: claps on 2 and 4 (or stomp-stomp-clap, or every beat), every beat in the last bar, then a short roll. */
function clapAlong({ t0, gapStart, pickupAt, gB, phase, rng, landing = null, rollScale = 1 }: BridgeArgs & { rng: () => number }, lastBar: number): PlanEvent[] {
  const level = MOVES.bridges.claps;
  const bpm = 60 / gB.beat;
  const style = bpm < 90 || bpm > 150 ? 'plain' : pick(['plain', 'plain', 'stomp', 'every'] as const, rng);
  const claps: number[] = [];
  const stomps: number[] = [];
  const kicks: number[] = [];
  for (let bar = t0; bar < lastBar - 1e-6; bar += gB.bar) {
    for (let k = 0; k < gB.bpb; k++) {
      const t = bar + k * gB.beat;
      if (style === 'every' || k % 2 === 1) claps.push(t);
      if (style === 'stomp' && k % 2 === 0) stomps.push(t, t + gB.beat / 2);
      if (k % 2 === 0) kicks.push(t);
    }
  }
  // Last bar: a clap on every beat, eighths on the last one, and a roll over its last two beats.
  for (let k = 0; k < gB.bpb; k++) {
    const t = lastBar + k * gB.beat;
    if (t >= gapStart - 0.05) break;
    claps.push(t);
    if (k === gB.bpb - 1 && t + gB.beat / 2 < gapStart - 0.05) claps.push(t + gB.beat / 2);
  }
  const events: PlanEvent[] = [
    synth('riser', { t0, t1: gapStart, fromHz: 800, toHz: 9000, fromDb: -30, toDb: loudness(phase) }),
    synth('claps', { times: claps, level }),
    synth('kicks', { times: kicks, level: 0.4 }),
  ];
  if (stomps.length) events.push(synth('claps', { times: stomps, level, stomp: true }));
  const rollFrom = Math.max(t0, gapStart - 2 * gB.beat);
  events.push(synth('snareRoll', { t0: rollFrom, t1: gapStart, beat: gB.beat, pitchTo: phase.snarePitch ?? 5, stages: [0.25, 0.125], velFrom: 80 * rollScale, velTo: 120 * rollScale }));
  events.push(...swellLayer(landing, rollFrom, gapStart, loudness(phase) - 2));
  events.push(...busSweep(t0, gapStart, pickupAt, gB));
  return events;
}
