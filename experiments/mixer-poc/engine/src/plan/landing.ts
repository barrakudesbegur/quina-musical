// The landing layer: what fills the moment before B's hook and what hits on it. It used to be the same
// reverse-cymbal swell and impact on every landing (the most repeated sound of the show); now it rotates
// (docs/dj-techniques.md › weakest recipes, D12, D14):
//  - cymbal: the reverse-cymbal swell into the gap, the sub impact and the Phase's samples;
//  - dry: no swell, a smaller impact and no samples (the "alien swell" release, cleanest in early Phases);
//  - preverb (D12, P3): B's own first beat (its chord, or its first word) reversed through a reverb, inhaled
//    into the pickup;
//  - tape (D14, P5): B powers up in the gap, from a growl to full speed exactly at its pickup.
// The impact's samples and their timing vary too.
import { MOVES } from '../config.ts';
import type { PhaseEffects } from '../config.ts';
import { weightedPick } from '../rng.ts';
import { between, pick, sfx, synth } from './events.ts';
import type { PlanEvent, PreverbEvent, PreverbSource } from './events.ts';
import type { HookGrid } from './timeline.ts';

export const LANDING_STYLES = ['cymbal', 'dry', 'preverb', 'tape'] as const;
export type LandingStyle = (typeof LANDING_STYLES)[number];

/** How a transition lands: the layer before the pickup, and the samples on the impact (`sampleLeadSec` before T). */
export interface Landing {
  style: LandingStyle;
  samples: ReadonlyArray<readonly [string, number]>;
  sampleLeadSec: number;
}

/** The landing every transition had before the rotation (Suspense's release still uses it). */
export function classicLanding(phase: PhaseEffects): Landing {
  return { style: 'cymbal', samples: phase.impactSamples, sampleLeadSec: 0.03 };
}

/**
 * Draws the landing for a transition. `preverb`: B's pre-verb is rendered and may overlap whatever is left
 * of A. `tape`: B can power up inside the gap (D14); `tapeBoost` multiplies its weight (after a stop). `force`
 * wins when it is possible.
 */
export function chooseLanding({ phase, rng, preverb, tape = false, tapeBoost = 1, force = null }: {
  phase: PhaseEffects; rng: () => number; preverb: boolean; tape?: boolean; tapeBoost?: number; force?: LandingStyle | null;
}): Landing {
  const weights = { ...MOVES.landing.weights[phase.name] };
  if (!preverb) weights.preverb = 0;
  weights.tape = tape ? weights.tape * tapeBoost : 0;
  const drawn = weightedPick(weights, rng) ?? 'cymbal';
  const possible = (style: LandingStyle) => (style === 'preverb' ? preverb : style === 'tape' ? tape : true);
  const style = force && possible(force) ? force : drawn;
  const samples = pick(MOVES.landing.impacts[phase.name], rng);
  const sampleLeadSec = between(MOVES.landing.sampleLeadSec[0], MOVES.landing.sampleLeadSec[1], rng);
  return { style, samples, sampleLeadSec };
}

/** The reverse-cymbal swell into the gap: only on a cymbal landing (the others bring their own, or none). */
export function swellLayer(landing: Landing | null | undefined, t0: number, t1: number, peakDb: number): PlanEvent[] {
  if (landing && landing.style !== 'cymbal') return [];
  return [synth('swell', { t0, t1, peakDb })];
}

/**
 * The hit at T: the sub impact (bigger each Phase, plus `boost`), and the landing's samples just before it.
 * A dry landing keeps a smaller sub drop only.
 */
export function impactLayer({ T, phase, landing = null, boost = 0 }: { T: number; phase: PhaseEffects; landing?: Landing | null; boost?: number }): PlanEvent[] {
  const base = { early: 0.45, mid: 0.6, late: 0.75, final: 0.9 }[phase.name] ?? 0.6;
  const dry = landing?.style === 'dry';
  const level = Math.min(1, (base + boost) * (dry ? MOVES.landing.dryImpactScale : 1));
  const events: PlanEvent[] = [synth('impact', { at: T, level })];
  if (dry) return events;
  const lead = landing?.sampleLeadSec ?? 0.03;
  for (const [name, db] of landing?.samples ?? phase.impactSamples) events.push(sfx(name, T - lead, db));
  return events;
}

/**
 * D12: B's pre-verb render (of its mix, or of its vocals), ending a breath before the pickup, over
 * phase{½, ¾, 1, 1} of B's bar (shortened to start after `minStart`).
 * @returns null when less than MOVES.preverb.minSec of it would fit
 */
export function preverbEvent({ hookId, pickupAt, minStart, gB, phase, rng, source = 'mix' }: {
  hookId: string; pickupAt: number; minStart: number; gB: HookGrid; phase: PhaseEffects; rng: () => number; source?: PreverbSource;
}): PreverbEvent | null {
  const cfg = MOVES.preverb;
  const until = pickupAt - between(cfg.breathSec[0], cfg.breathSec[1], rng);
  const at = Math.max(minStart, until - cfg.lengthBars[phase.name] * gB.bar);
  if (until - at < cfg.minSec) return null;
  return { kind: 'preverb', deck: 'B', hookId, at, until, gainDb: cfg.gainDb[phase.name], hpfHz: cfg.hpfHz, ...(source === 'mix' ? {} : { source }) };
}
