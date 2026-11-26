// Pace, Spin length, auto-advance timing, and a basic Schedule estimate with Drift. Pure functions, tested
// in Node. Terms follow GLOSSARY.md: the Pace is the target time from one landing to the next; the Spin
// takes about half of it (3–11 s); late phases may stretch a song's slot by up to about 50%. The Pace is a
// repeat's slot: a song's first play in the Game gets FIRST_PLAY_FACTOR times it (D174, D175).
import { firstPlaySec, isPhaseName, type RoundKind } from '@quina/protocol';
import { PACE, SCHEDULE } from '../config.ts';
import type { PhaseTiming } from '../config.ts';
import type { Timeline } from './timeline.ts';

/** The Schedule's numbers (config.ts SCHEDULE); tests may pass their own. */
export type ScheduleConfig = { readonly [K in keyof typeof SCHEDULE]: number };

export const SPIN_LIMITS = PACE.spinLimits;
export const PACE_PRESETS = PACE.presets;
export const PACE_LIMITS = PACE.limits;
export const SCHEDULE_DEFAULTS = SCHEDULE;
/** A first play's slot over a repeat's (22/14, D175). */
export const FIRST_PLAY_FACTOR = firstPlaySec(1);
/**
 * Songs counted in slots: each first play is FIRST_PLAY_FACTOR repeats long. `firstPlays` are those among the `songs`
 * whose slots are still to come.
 */
export const slotSongs = (songs: number, firstPlays: number): number => songs + Math.min(Math.max(0, firstPlays), songs) * (FIRST_PLAY_FACTOR - 1);
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

/** A's downbeats on the context clock and where they sit in its phrases (a deckTimeline). */
export type PhraseGrid = Pick<Timeline, 'downbeatsBetween' | 'phraseClass'>;

/** Where an automatic Next should land, in the outgoing song A, and when it should press for that. */
export interface AlignArgs {
  grid: PhraseGrid;
  /** When the landing would come without phrases (context time). */
  idealLandAt: number;
  /** The slot it belongs to: the range around the ideal landing is a share of it (PACE.phraseSlotRange). */
  slot: number;
  /** The Spin's target length: the press comes this long before the landing. */
  dTarget: number;
  /** The press never comes before this. */
  earliestPress: number;
  /** A must still be playing at the landing (context time of A's end, with a margin). */
  latestLand: number;
  /** How long a press takes to start the Spin (the planner's lookahead). */
  lookaheadSec: number;
  /** Never land sooner than this share of the slot (1 when the slot was stretched for a Claim). */
  minShare?: number;
}

/**
 * The press for a landing on A's phrase boundary: the 8-bar boundary nearest the ideal landing within the
 * slot's range (×0.75–1.4 for a landing's slot), else the nearest 4-bar one. A 4-bar boundary wins only when it
 * is much nearer (PACE.phrase4Penalty, a share of the slot), so the Pace holds. The press comes `dTarget` before
 * the landing, so the planner finds the boundary in the middle of its window.
 * @returns null when no boundary fits (no landed hook to count from, irregular bars, the song ends)
 */
export function alignedPress({ grid, idealLandAt, slot, dTarget, earliestPress, latestLand, lookaheadSec, minShare }: AlignArgs): { pressAt: number; landAt: number; index: number } | null {
  const earliestLand = earliestPress + lookaheadSec + dTarget;
  const boundaries = ([lo, hi]: readonly [number, number]) => {
    const from = Math.max(idealLandAt - (1 - Math.max(lo, minShare ?? 0)) * slot, earliestLand);
    const to = Math.min(idealLandAt + (hi - 1) * slot, latestLand);
    return to < from ? [] : grid.downbeatsBetween(from, to).map((d) => ({ ...d, cls: grid.phraseClass(d.index) })).filter((d) => d.cls !== 'bar');
  };
  const cost = (d: { ctxTime: number; cls: string }) => Math.abs(d.ctxTime - idealLandAt) / slot + (d.cls === 'phrase8' ? 0 : PACE.phrase4Penalty);
  const cheapest = <T extends { ctxTime: number; cls: string }>(list: T[]) => list.reduce<T | null>((b, d) => (!b || cost(d) < cost(b) ? d : b), null);
  // A slow song's 4 bars can straddle the slot's range: a boundary a little outside it still beats a landing
  // mid-phrase.
  const best = cheapest(boundaries(PACE.phraseSlotRange)) ?? cheapest(boundaries(PACE.phraseSlotRangeWide));
  return best && { pressAt: best.ctxTime - dTarget - lookaheadSec, landAt: best.ctxTime, index: best.index };
}

/** After a Hold is released with the landed song still playing: let it breathe, then move on. */
export function pressAfterHold({ now, pace, phase, nudge = 1 }: PaceArgs & { now: number }): number {
  const { slot, dTarget } = spinWindow({ pace, phase, nudge });
  return now + Math.max(PACE.minAfterHoldSec, (slot - dTarget) / 2);
}

/**
 * Songs a round of this kind is expected to last: `songs` when its Queue and cards in play are known (the Queue
 * index of its first Bingo or last card standing, plus one), else the config's typical count (a Desgraciat round
 * ends far sooner, and has no Line to check).
 */
export const roundSongs = (kind: RoundKind, cfg: ScheduleConfig = SCHEDULE, songs: number | null = null): number =>
  songs ?? (kind === 'desgraciat' ? cfg.desgraciatAtSong : cfg.bingoAtSong);
const roundChecksSec = (kind: RoundKind, cfg: ScheduleConfig, lineConfirmed = false) =>
  (kind === 'desgraciat' || lineConfirmed ? 0 : cfg.lineCheckSec) + cfg.bingoCheckSec;

/**
 * Expected seconds until the current round ends, from the Queue position (index of the last landed song).
 * `firstPlays`: first plays among the songs whose slots are still to come (the one playing to the second-to-last).
 */
export function roundRemainingSec({ position, pace, phase = 'early', lineConfirmed = false, kind = 'normal', songs = null, firstPlays = 0, cfg = SCHEDULE, nudge = 1 }: {
  position: number; pace: number; phase?: string; lineConfirmed?: boolean; kind?: RoundKind; songs?: number | null; firstPlays?: number; cfg?: ScheduleConfig; nudge?: number;
}): number {
  const landed = position + 1;
  const songsLeft = Math.max(2, roundSongs(kind, cfg, songs) - landed);
  const slot = slotSec({ pace, phase: 'early', nudge }) * 0.75 + slotSec({ pace, phase, nudge }) * 0.25;
  return slotSongs(songsLeft, firstPlays) * slot + roundChecksSec(kind, cfg, lineConfirmed);
}

/**
 * A whole round from its first song, at a given Pace (the round's target, and later rounds). `firstPlays`: its songs
 * that are first plays in the Game (D174), each with the longer slot.
 */
export function roundLengthSec({ pace, kind = 'normal', songs = null, firstPlays = 0, cfg = SCHEDULE }: { pace: number; kind?: RoundKind; songs?: number | null; firstPlays?: number; cfg?: ScheduleConfig }): number {
  return slotSongs(roundSongs(kind, cfg, songs), firstPlays) * pace + roundChecksSec(kind, cfg);
}

/**
 * The songs left to a Game for later rounds' first plays: the pool's size, and how many of it no round has played by
 * the current round's expected end. Each later round's Queue is a fresh Shuffle of the pool, so a round of N songs
 * expects N × unplayed / songs first plays (about 70 × (24/70)^m left after m rounds of 46).
 */
export interface PoolLeft {
  songs: number;
  unplayed: number;
}

/** When the round and the game should end (epoch ms), and the Drift in seconds (positive = running late). */
export interface ScheduleEstimate {
  roundEndMs: number;
  gameEndMs: number;
  roundDriftSec: number;
  gameDriftSec: number | null;
}

/**
 * The rest of the night as the Game plan has it: the rounds after the current one (in order, by kind), the planned
 * Interval, and the planned Throws still to come (the one after the current round included).
 */
export interface LaterRounds {
  kinds: readonly RoundKind[];
  intervalSec: number;
  throwsSec: number;
}

/** What scheduleEstimate needs. `round.targetEndMs` is fixed when the round starts. */
export interface ScheduleArgs extends PaceArgs {
  nowMs: number;
  /**
   * `songs`: the round's exact count when its Queue and cards in play are known (roundSongs). `firstPlays`: first plays
   * among the songs whose slots are still to come (roundRemainingSec).
   */
  round: { number: number; kind?: RoundKind; targetEndMs?: number | null; songs?: number | null; firstPlays?: number };
  game: { roundsTotal?: number; targetEndMs?: number | null };
  position: number;
  lineConfirmed?: boolean;
  /** The presenters locked the Pace: later rounds keep it, else they start at the default (PACE.defaultSec). */
  locked?: boolean;
  /** From the Game plan; without one, `game.roundsTotal` normal rounds with the default Interval and no Throws. */
  later?: LaterRounds | null;
  /** For later rounds' expected first plays; without it they count none. */
  pool?: PoolLeft | null;
  cfg?: ScheduleConfig;
}

/**
 * Basic Schedule: when the round and the game should end, and the Drift (positive = running late).
 * Times are epoch ms; `round.targetEndMs` is fixed when the round starts.
 */
export function scheduleEstimate({ nowMs, round, game, position, pace, phase, lineConfirmed = false, locked = false, later: plan = null, pool = null, cfg = SCHEDULE, nudge = 1 }: ScheduleArgs): ScheduleEstimate {
  const roundEndMs = nowMs + 1000 * roundRemainingSec({ position, pace, phase, lineConfirmed, kind: round.kind, songs: round.songs, firstPlays: round.firstPlays, cfg, nudge });
  // Each later round at the Pace it starts with, its first plays drawn from what no round has played yet: rounds of
  // new songs are slower (D174).
  const kinds = plan ? plan.kinds : Array.from({ length: Math.max(0, (game.roundsTotal ?? cfg.roundsTotal) - round.number) }, () => 'normal' as const);
  const laterPace = locked ? pace : PACE.defaultSec;
  let unplayed = pool ? Math.max(0, Math.min(pool.unplayed, pool.songs)) : 0;
  const later = kinds.reduce((sec, kind) => {
    const songs = roundSongs(kind, cfg);
    const firstPlays = pool && pool.songs > 0 ? (Math.min(songs, pool.songs) * unplayed) / pool.songs : 0;
    unplayed -= firstPlays;
    return sec + (plan ? plan.intervalSec : cfg.intervalSec) + roundLengthSec({ pace: laterPace, kind, firstPlays, cfg });
  }, plan ? plan.throwsSec : 0);
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
export function driftNudge({ driftSec, position, pace, phase, locked = false, kind = 'normal', songs = null, firstPlays = 0, cfg = SCHEDULE }: {
  driftSec: number; position: number; pace: number; phase: string; locked?: boolean; kind?: RoundKind; songs?: number | null; firstPlays?: number; cfg?: ScheduleConfig;
}): number {
  if (locked || !timingOf(phase).nudge || !Number.isFinite(driftSec)) return 1;
  const songsLeft = Math.max(4, roundSongs(kind, cfg, songs) - (position + 1));
  return clamp(1 - driftSec / (slotSongs(songsLeft, firstPlays) * pace), PACE.nudgeLimits[0], PACE.nudgeLimits[1]);
}
