// The pulse of the song the room hears (`state.beat`, PUBLIC): its tempo as heard, its metre and one reference
// downbeat, so a phone can bob the card marks with a pure CSS loop. Pure functions over a song's analysis and its deck
// clock (like plan/loop.ts), and the rule that keeps the published value as it is unless the grid changed materially:
// every change goes out to every phone. The show picks which deck the room hears (show.ts beatCandidate).
import type { BeatInfo } from '@quina/protocol';
import { BEAT } from '../config.ts';
import type { Analysis } from '../analysis.ts';
import type { DeckClock } from './timeline.ts';

export type BeatConfig = typeof BEAT;

/** A grid on the audio clock: `downbeatAt` is a bar's first beat, in context seconds. */
export interface BeatGrid {
  bpm: number;
  beatsPerBar: number;
  downbeatAt: number;
}

/** The deck a grid comes from: its song and clock. Another song, or a clock that moved (a loop's re-cue, a Pausa
 * resume), is another source. */
export interface BeatSource {
  songId: number;
  startCtx: number;
  offset: number;
  rate: number;
}

/** What was last published: the value (null: no song heard), the deck it came from, and when it was sent (epoch ms). */
export interface BeatPublication {
  info: BeatInfo | null;
  source: BeatSource | null;
  sentAtMs: number;
}

export const NO_BEAT: BeatPublication = Object.freeze({ info: null, source: null, sentAtMs: -Infinity });

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The song's local tempo from downbeat `index` on (at rate 1): the median of its next `bars` bars (fewer near the song's
 * end) as beats per minute; the analysis' tempo.bpm when there is no bar after it.
 */
export function localBpm(analysis: Analysis, index: number, bars: number = BEAT.tempoBars): number {
  const d = analysis.downbeats;
  const bpb = analysis.tempo.beatsPerBar || 4;
  const intervals: number[] = [];
  for (let k = Math.max(0, index); k < Math.min(d.length - 1, index + bars); k++) intervals.push(d[k + 1] - d[k]);
  const bar = intervals.length ? median(intervals) : 0;
  return bar > 0 ? (60 * bpb) / bar : analysis.tempo.bpm;
}

/**
 * The grid a deck plays at `now`: anchored on the song's latest downbeat at or before the clock's reference moment
 * (now, or the clock's start when it starts ahead: a re-cue's own downbeat), never earlier than the downbeat it lands
 * on: before its landing, a deck is anchored there, ahead of now. Any other anchor ahead of now (a re-cue's) is moved
 * back whole bars of its grid. The tempo is the local tempo from the anchor on, times the deck's rate.
 * @returns null for a song with no downbeats
 */
export function deckBeat(analysis: Analysis, deck: DeckClock, landedDownbeatIndex: number | null, now: number, config: BeatConfig = BEAT): BeatGrid | null {
  const d = analysis.downbeats;
  if (!d.length) return null;
  const rate = deck.rate || 1;
  const pos = deck.offset + (Math.max(now, deck.startCtx) - deck.startCtx) * rate;
  let index = -1;
  for (let k = 0; k < d.length && d[k] <= pos + 1e-9; k++) index = k;
  // Not there yet: the downbeat it lands on (a Spin's incoming song before its landing).
  const landed = landedDownbeatIndex != null && landedDownbeatIndex < d.length ? landedDownbeatIndex : -1;
  const landing = index < landed;
  if (landing) index = landed;
  if (index < 0) index = 0; // before the song's first downbeat: that one
  const beatsPerBar = analysis.tempo.beatsPerBar || 4;
  const bpm = localBpm(analysis, index, config.tempoBars) * rate;
  let downbeatAt = deck.startCtx + (d[index] - deck.offset) / rate;
  if (downbeatAt > now && !landing) {
    const bar = (60 * beatsPerBar) / bpm;
    downbeatAt -= Math.ceil((downbeatAt - now) / bar - 1e-9) * bar;
  }
  return { bpm, beatsPerBar, downbeatAt };
}

/** The grid as the state carries it: epoch ms (whole), bpm to a thousandth. */
export function beatInfo(grid: BeatGrid, toEpochMs: (ctxSec: number) => number): BeatInfo {
  return { bpm: Math.round(grid.bpm * 1000) / 1000, beatsPerBar: grid.beatsPerBar, downbeatAtMs: Math.round(toEpochMs(grid.downbeatAt)) };
}

/** How far `atMs` is from the nearest downbeat of `grid` (its bars carried on both ways), in ms. */
export function phaseOffMs(grid: BeatInfo, atMs: number): number {
  const bar = (60_000 * grid.beatsPerBar) / grid.bpm;
  const x = (((atMs - grid.downbeatAtMs) % bar) + bar) % bar;
  return Math.min(x, bar - x);
}

/** Two values phones would play the same: the same metre, the bpm within `bpmTolerance`, and b's downbeat on a's grid
 * within `driftMs` (modulo a bar). */
export function sameGrid(a: BeatInfo, b: BeatInfo, config: BeatConfig = BEAT): boolean {
  return a.beatsPerBar === b.beatsPerBar && Math.abs(b.bpm / a.bpm - 1) <= config.bpmTolerance && phaseOffMs(a, b.downbeatAtMs) <= config.driftMs;
}

const sameSource = (a: BeatSource | null, b: BeatSource | null) =>
  a === b || (a != null && b != null && a.songId === b.songId && a.startCtx === b.startCtx && a.offset === b.offset && a.rate === b.rate);

/**
 * Whether phones would show `a` and `b` the same at `nowMs`: the same grid (`sameGrid`), and either both moving or
 * both waiting for the same downbeat ahead (a landing's).
 */
export function playsSame(a: BeatInfo, b: BeatInfo, nowMs: number, config: BeatConfig = BEAT): boolean {
  const aWaits = a.downbeatAtMs > nowMs;
  if (aWaits !== b.downbeatAtMs > nowMs) return false;
  if (aWaits && Math.abs(a.downbeatAtMs - b.downbeatAtMs) > config.driftMs) return false;
  return sameGrid(a, b, config);
}

/**
 * The value to publish now, from the last one and the grid heard now (`candidate`, null: no song heard):
 * - null to a value or back, at once;
 * - another source (another song, a moved clock): the candidate at once, unless phones would show it the same
 *   (`playsSame`), when the published value stays and only its source moves on;
 * - the same source: a landing's anchor ahead of now stays until it passes; after that the candidate replaces it once
 *   its downbeat drifts more than `driftMs` from the published grid, at most once per `minReanchorSec`.
 * @returns `prev` itself when nothing changes, so the caller can tell
 */
export function nextBeat(prev: BeatPublication, candidate: { info: BeatInfo; source: BeatSource } | null, nowMs: number, config: BeatConfig = BEAT): BeatPublication {
  const published = prev.info;
  if (!candidate) return published ? { info: null, source: null, sentAtMs: nowMs } : prev;
  const sent = { info: candidate.info, source: candidate.source, sentAtMs: nowMs };
  if (!published) return sent;
  if (!sameSource(prev.source, candidate.source)) {
    return playsSame(published, candidate.info, nowMs, config) ? { ...prev, source: candidate.source } : sent;
  }
  if (published.downbeatAtMs > nowMs) return prev;
  if (phaseOffMs(published, candidate.info.downbeatAtMs) <= config.driftMs) return prev;
  return nowMs - prev.sentAtMs >= config.minReanchorSec * 1000 ? sent : prev;
}
