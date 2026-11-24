// Decoys (an experiment, OFF by default: config.ts DECOYS.enabled; docs/decoys.md explains how to try,
// tune or delete it). In the first bars of an S2 bridge, after A has gone, the "wrong record" comes in: a
// song that already landed this round, low-passed, from its hook. A tape stop cuts it off, and the real
// build carries on into the song that lands. Rules: a Decoy is never the song that lands, it is always a song
// that already counted (so it can never count again), and it ends at least a bar before the landing, so the
// landing resolves clearly. This module is pure; the show adds its events only when the flag is on.
import { DECOYS, type DecoyConfig } from '../config.ts';
import { sfx } from './recipes.ts';
import { eventStart, type Plan } from './planner.ts';
import type { Analysis, Hook } from '../analysis.ts';
import type { DecoyEvent, PlanEvent } from './recipes.ts';
import type { PhaseName } from '@quina/protocol';

/** A song that already landed this round, whose audio is decoded. */
export interface DecoySource {
  songId: number;
  analysis: Analysis;
  /** The hook it plays from (the one it landed on). */
  hook: Hook;
}

export interface DecoyRequest {
  plan: Plan;
  source: DecoySource;
  phase: PhaseName;
  rng: () => number;
  config?: DecoyConfig;
}

/** The Decoy's events for this plan, or null when it doesn't fit or the dice say no. */
export function decoyLayer({ plan, source, phase, rng, config = DECOYS }: DecoyRequest): PlanEvent[] | null {
  if (source.songId === plan.b.songId) return null; // never the song that lands
  if (plan.shape !== 'S2' || !plan.a || plan.bridgeBars < config.minBridgeBars) return null;
  if (!(rng() < (config.chance[phase] ?? 0))) return null;
  // It comes in one of B's beats after A's exit downbeat, as A's echo or wash tail fades.
  const start = plan.exitAt + plan.hook.beat;
  // It must be over (tape stop included) before B or anything of B is heard, and leave the last bar of the
  // bridge to the real build.
  const bFirst = firstSoundOfB(plan);
  const lastBar = plan.T - plan.hook.bar;
  const cutAt = Math.min(start + config.maxSec, bFirst - config.cutSec - 0.1, lastBar - config.cutSec);
  if (cutAt - start < config.minSec) return null;
  const pickup = Math.min(source.hook.pickupSec || 0, source.hook.downbeatSec);
  const decoy: DecoyEvent = {
    kind: 'decoy',
    songId: source.songId,
    at: start,
    offset: source.hook.downbeatSec - pickup,
    cutAt,
    cutSec: config.cutSec,
    gainDb: config.gainDb + clamp(source.hook.gainToTargetDb ?? source.analysis.loudness?.gainToTargetDb ?? 0, -12, 6),
    lpfHz: config.lpfHz,
  };
  return [decoy, sfx(config.cutSfx, cutAt + config.cutSec * 0.6, -6)];
}

/**
 * When anything of the landing song is first heard: B itself, its stems, stem lanes, slices (a vocal chop, a
 * riff gate), scratch, pre-verb, Signature (a call, a riff bed), Blend, or a B param move.
 */
export function firstSoundOfB(plan: Plan): number {
  const bEvents = plan.events.filter((e) =>
    e.kind === 'stems' || e.kind === 'blend' || e.kind === 'preverb' || e.kind === 'scratch' ||
    ((e.kind === 'signature' || e.kind === 'stemLane' || e.kind === 'slices') && e.deck === 'B') ||
    ('target' in e && e.target.startsWith('B.')));
  return Math.min(plan.b.startCtx, ...bEvents.map(eventStart));
}

/** The plan with a Decoy, if `decoyLayer` gives one; the same plan object otherwise. */
export function withDecoy<P extends Plan>(plan: P, request: Omit<DecoyRequest, 'plan'>): P {
  const events = decoyLayer({ ...request, plan });
  if (!events) return plan;
  return { ...plan, events: [...plan.events, ...events].sort((x, y) => eventStart(x) - eventStart(y)) };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
