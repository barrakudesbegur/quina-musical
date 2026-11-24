// Pace, Spin length, auto-advance timing, and a basic Schedule estimate with Drift. Pure functions, tested
// in Node. Terms follow GLOSSARY.md: the Pace is the target time from one landing to the next; the Spin
// takes about half of it (3–11 s); late phases may stretch a song's slot by up to about 50%.
import { isPhaseName } from '@quina/protocol';
import { PACE, SCHEDULE } from '../config.ts';
import type { PhaseTiming } from '../config.ts';

/** The Schedule's numbers (config.ts SCHEDULE); tests may pass their own. */
export type ScheduleConfig = { readonly [K in keyof typeof SCHEDULE]: number };

export const SPIN_LIMITS = PACE.spinLimits;
export const PACE_PRESETS = PACE.presets;
export const PACE_LIMITS = PACE.limits;
export const SCHEDULE_DEFAULTS = SCHEDULE;
/** @param roundNumber 1-based */
export const defaultPace = (roundNumber: number): number => (roundNumber <= 1 ? PACE.firstRoundSec : PACE.laterRoundsSec);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** An unknown phase name times like early. */
const timingOf = (phase: string): PhaseTiming => (isPhaseName(phase) ? PACE.timing[phase] : PACE.timing.early);

/** What every Pace computation needs: the Pace, the Phase and the Drift nudge (1 = none). */
export interface PaceArgs {
  pace: number;
  phase: string;
  nudge?: number;
}

/** A slot or Spin request: `minStretch` raises the phase's stretch. */
export interface SlotArgs extends PaceArgs {
  minStretch?: number;
}

/**
 * The slot (landing to landing) for the next song, with the Drift nudge applied. `minStretch` raises the
 * phase's stretch (a landing that probably completes a card uses PACE.completionStretch).
 */
export function slotSec({ pace, phase, nudge = 1, minStretch = 1 }: SlotArgs): number {
  const timing = timingOf(phase);
  return pace * Math.max(timing.stretch, minStretch) * (timing.nudge ? nudge : 1);
}

/** The Spin's length: a target and the range the planner may use, inside the slot. */
export interface SpinWindow {
  slot: number;
  dTarget: number;
  dMin: number;
  dMax: number;
}

/** Spin window for the planner: the target is a share of the slot, kept inside 3–11 s. */
export function spinWindow({ pace, phase, nudge = 1, minStretch = 1 }: SlotArgs): SpinWindow {
  const timing = timingOf(phase);
  const slot = slotSec({ pace, phase, nudge, minStretch });
  const dTarget = clamp(slot * timing.spinShare, SPIN_LIMITS[0], SPIN_LIMITS[1]);
  const spread = Math.max(1, 0.15 * dTarget);
  return {
    slot,
    dTarget,
    dMin: clamp(dTarget - spread, SPIN_LIMITS[0], SPIN_LIMITS[1]),
    dMax: clamp(dTarget + spread, SPIN_LIMITS[0], SPIN_LIMITS[1]),
  };
}

/**
 * When auto-advance should press Next after a landing at `landedAt`, so the next landing comes one slot
 * later. The landed song always plays on its own for a moment first.
 * The coming Spin is planned with the normal window, so a stretched slot plays the landed song longer.
 */
export function autoPressAt({ landedAt, pace, phase, nudge = 1, minSoloSec = PACE.minSoloSec, minStretch = 1 }: SlotArgs & { landedAt: number; minSoloSec?: number }): number {
  const slot = slotSec({ pace, phase, nudge, minStretch });
  const { dTarget } = spinWindow({ pace, phase, nudge });
  return landedAt + Math.max(minSoloSec, slot - dTarget);
}

/** After a Hold is released with the landed song still playing: let it breathe, then move on. */
export function pressAfterHold({ now, pace, phase, nudge = 1 }: PaceArgs & { now: number }): number {
  const { slot, dTarget } = spinWindow({ pace, phase, nudge });
  return now + Math.max(PACE.minAfterHoldSec, (slot - dTarget) / 2);
}

/** Expected seconds until the current round ends, from the Queue position (index of the last landed song). */
export function roundRemainingSec({ position, pace, phase = 'early', lineConfirmed = false, cfg = SCHEDULE, nudge = 1 }: {
  position: number; pace: number; phase?: string; lineConfirmed?: boolean; cfg?: ScheduleConfig; nudge?: number;
}): number {
  const landed = position + 1;
  const songsLeft = Math.max(2, cfg.bingoAtSong - landed);
  const slot = slotSec({ pace, phase: 'early', nudge }) * 0.75 + slotSec({ pace, phase, nudge }) * 0.25;
  return songsLeft * slot + (lineConfirmed ? 0 : cfg.lineCheckSec) + cfg.bingoCheckSec;
}

/** A whole round from its first song, at a given Pace (the round's target, and later rounds). */
export function roundLengthSec({ pace, cfg = SCHEDULE }: { pace: number; cfg?: ScheduleConfig }): number {
  return cfg.bingoAtSong * pace + cfg.lineCheckSec + cfg.bingoCheckSec;
}

/** When the round and the game should end (epoch ms), and the Drift in seconds (positive = running late). */
export interface ScheduleEstimate {
  roundEndMs: number;
  gameEndMs: number;
  roundDriftSec: number;
  gameDriftSec: number | null;
}

/** What scheduleEstimate needs. `round.targetEndMs` is fixed when the round starts. */
export interface ScheduleArgs extends PaceArgs {
  nowMs: number;
  round: { number: number; targetEndMs?: number | null };
  game: { roundsTotal?: number; targetEndMs?: number | null };
  position: number;
  lineConfirmed?: boolean;
  cfg?: ScheduleConfig;
}

/**
 * Basic Schedule: when the round and the game should end, and the Drift (positive = running late).
 * Times are epoch ms; `round.targetEndMs` is fixed when the round starts.
 */
export function scheduleEstimate({ nowMs, round, game, position, pace, phase, lineConfirmed = false, cfg = SCHEDULE, nudge = 1 }: ScheduleArgs): ScheduleEstimate {
  const roundEndMs = nowMs + 1000 * roundRemainingSec({ position, pace, phase, lineConfirmed, cfg, nudge });
  const roundsAfter = Math.max(0, (game.roundsTotal ?? cfg.roundsTotal) - round.number);
  const later = roundsAfter * (cfg.intervalSec + roundLengthSec({ pace: defaultPace(round.number + 1), cfg }));
  const gameEndMs = roundEndMs + 1000 * later;
  return {
    roundEndMs,
    gameEndMs,
    roundDriftSec: round.targetEndMs ? (roundEndMs - round.targetEndMs) / 1000 : 0,
    gameDriftSec: game.targetEndMs ? (gameEndMs - game.targetEndMs) / 1000 : null,
  };
}

/**
 * How much to stretch (>1) or squeeze (<1) the coming slots to recover the Drift over the rest of the
 * round. Only early and mid phases are nudged, and never when the presenters locked the Pace.
 */
export function driftNudge({ driftSec, position, pace, phase, locked = false, cfg = SCHEDULE }: {
  driftSec: number; position: number; pace: number; phase: string; locked?: boolean; cfg?: ScheduleConfig;
}): number {
  if (locked || !timingOf(phase).nudge || !Number.isFinite(driftSec)) return 1;
  const songsLeft = Math.max(4, cfg.bingoAtSong - (position + 1));
  return clamp(1 - driftSec / (songsLeft * pace), PACE.nudgeLimits[0], PACE.nudgeLimits[1]);
}
