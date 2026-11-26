// The pool-size report (R1-Q31, docs/requirements/songs-and-cards.md): for a pool of songs and the cards sold, how many
// songs a round takes to its first Line, its Bingo, and the Desgraciat's last card standing. It helps choose the
// playlist's size: more songs mean longer rounds. The engine's Queue is a random order of the whole pool, so this
// simulates many random orders against the cards and reports the spread. Pure: the cards and a seed come in.

/** A card as cards.json holds it, reduced to its song ids: 3 lines of 4. */
export interface ReportCard {
  lines: number[][];
}

export interface Spread {
  /** Songs played (1 = the first landing), over all the simulated rounds. */
  p10: number;
  median: number;
  p90: number;
}

export interface PoolReport {
  songs: number;
  cards: number;
  runs: number;
  /** Songs until some card completes a Line. */
  firstLine: Spread;
  /** Songs until some card completes all 12 (the Quina). */
  bingo: Spread;
  /** The Desgraciat: songs until one card is left standing (every other card has had a song land). */
  lastStanding: Spread;
}

/** A small seeded random generator (mulberry32), so a report repeats. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { p10: at(0.1), median: at(0.5), p90: at(0.9) };
}

/**
 * Simulate `runs` rounds over the pool's songs (every song once, in a random order) against `cards`. Each result is a
 * count of songs played: the landing that completes the first Line, the first full card, and the one that leaves a
 * single card standing.
 */
export function poolReport(songIds: readonly number[], cards: readonly ReportCard[], runs: number, seed = 1): PoolReport {
  if (cards.length < 2) throw new Error('the report needs at least 2 cards');
  const random = seededRandom(seed);
  const order = [...songIds];
  const at = new Map<number, number>();
  const firstLine: number[] = [];
  const bingo: number[] = [];
  const lastStanding: number[] = [];
  for (let run = 0; run < runs; run++) {
    // A fresh Fisher–Yates shuffle: the Queue.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((id, i) => at.set(id, i));
    let line = Infinity;
    let full = Infinity;
    // The two latest falls: the last card standing is left once the second-latest has fallen.
    let latest = -1;
    let second = -1;
    for (const card of cards) {
      let fall = Infinity;
      let cardFull = -1;
      for (const songs of card.lines) {
        let lineDone = -1;
        for (const id of songs) {
          const p = at.get(id) ?? Infinity;
          if (p > lineDone) lineDone = p;
          if (p < fall) fall = p;
        }
        if (lineDone < line) line = lineDone;
        if (lineDone > cardFull) cardFull = lineDone;
      }
      if (cardFull < full) full = cardFull;
      if (fall > latest) {
        second = latest;
        latest = fall;
      } else if (fall > second) second = fall;
    }
    firstLine.push(line + 1);
    bingo.push(full + 1);
    lastStanding.push(second + 1);
  }
  return { songs: songIds.length, cards: cards.length, runs, firstLine: spread(firstLine), bingo: spread(bingo), lastStanding: spread(lastStanding) };
}

/**
 * How long the songs take, and the Checks on top (docs/requirements/show-and-music.md). The Pace is a copy of
 * @quina/protocol PACE_DEFAULT_SEC (a song's first play in the night 22 s, a repeat 14 s: D174, D175), which this
 * package can't import (it builds on its own); keep the two the same. 2025's real rounds averaged 16 minutes for about
 * 48 songs.
 */
export interface Timing {
  firstPlaySec: number;
  repeatSec: number;
  /** A Line's Check, in minutes (low, high). */
  lineCheckMin: readonly [number, number];
  /** The Quina's (or the last card standing's) Check and the round's end, in minutes (low, high). */
  endCheckMin: readonly [number, number];
}

export const DEFAULT_TIMING: Timing = Object.freeze({ firstPlaySec: 22, repeatSec: 14, lineCheckMin: [1, 2] as const, endCheckMin: [1.5, 3.5] as const });

/** A round's length in minutes (low, high): its median songs at the Pace (`firstPlays` of them new tonight), plus the Checks. */
export function roundMinutes(songs: number, kind: 'regular' | 'desgraciat', firstPlays: number, t: Timing = DEFAULT_TIMING): [number, number] {
  const play = (firstPlays * t.firstPlaySec + (songs - firstPlays) * t.repeatSec) / 60;
  const line = kind === 'regular' ? t.lineCheckMin : ([0, 0] as const);
  return [play + line[0] + t.endCheckMin[0], play + line[1] + t.endCheckMin[1]];
}

/** The plan's shape the night estimate needs (the Game plan JSON, read loosely: this package can't use the protocol). */
export interface NightShape {
  /** In play order: 'normal', 'special' or 'desgraciat'. */
  kinds: string[];
  intervalMinutes: number;
  throwMinutes: number;
}

/**
 * The whole night in minutes (low, high): every round in order, the Intervals between them and the planned Throws. Each
 * round's Queue is a fresh Shuffle of the pool, so a round of N songs expects N × (songs not played yet) / pool first
 * plays: all of round 1, about a third of round 2, fewer after.
 */
export function nightMinutes(r: PoolReport, night: NightShape, t: Timing = DEFAULT_TIMING): [number, number] {
  let lo = 0;
  let hi = 0;
  let unplayed = r.songs;
  for (const kind of night.kinds) {
    const desgraciat = kind === 'desgraciat';
    const songs = desgraciat ? r.lastStanding.median : r.bingo.median;
    const firstPlays = r.songs > 0 ? (Math.min(songs, r.songs) * unplayed) / r.songs : 0;
    unplayed -= firstPlays;
    const [a, b] = roundMinutes(songs, desgraciat ? 'desgraciat' : 'regular', firstPlays, t);
    lo += a;
    hi += b;
  }
  const between = Math.max(0, night.kinds.length - 1) * night.intervalMinutes + night.throwMinutes;
  return [lo + between, hi + between];
}

const range = ([a, b]: readonly [number, number]) => `${Math.round(a)}–${Math.round(b)} min`;
const hours = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;

/** The report in plain words: the songs first (what matters most), then how long rounds and the night take. */
export function describeReport(r: PoolReport, night: NightShape | null = null, t: Timing = DEFAULT_TIMING): string {
  const s = (x: Spread) => `${x.median} (${x.p10}–${x.p90})`;
  const lines = [
    `${r.songs} songs, ${r.cards} cards sold:`,
    `  first Line after ${s(r.firstLine)} songs`,
    `  Quina after ${s(r.bingo)} songs`,
    `  the Desgraciat's last card standing after ${s(r.lastStanding)} songs`,
    `  a regular round of songs already played takes about ${range(roundMinutes(r.bingo.median, 'regular', 0, t))} (of new songs, as round 1: ${range(roundMinutes(r.bingo.median, 'regular', r.bingo.median, t))}); the Desgraciat about ${range(roundMinutes(r.lastStanding.median, 'desgraciat', 0, t))}`,
  ];
  if (night) {
    const [lo, hi] = nightMinutes(r, night, t);
    lines.push(`  the night (${night.kinds.length} rounds, ${night.intervalMinutes}-min Intervals${night.throwMinutes ? `, ${night.throwMinutes} min of Throws` : ''}): about ${hours(lo)} to ${hours(hi)}`);
  }
  return lines.join('\n');
}
