// The phrase loop: the playing song repeats one of its phrases (4 or 8 bars, counted from the hook it landed on)
// for as long as the show needs. Aguanta (Stay) loops the song's last full phrase near its end, so the dancing never
// stops; Suspense loops the phrase it is in while the build grows. Pure functions over the song's analysis and its
// deck clock; the show schedules each repeat as a re-cue of the deck (show.ts tickLoop, audio/deck.ts cue).
import type { Analysis } from '../analysis.ts';
import type { DeckClock } from './timeline.ts';

/** A phrase of the song to repeat: song seconds [fromSec, toSec), `bars` of its downbeats from `fromIndex`. */
export interface PhraseLoop {
  fromSec: number;
  toSec: number;
  fromIndex: number;
  bars: number;
}

/** What the loop finders need: the song, where it plays, and the hook it landed on (its phrases count from there). */
export interface LoopSong {
  analysis: Analysis;
  deck: DeckClock;
  landedDownbeatIndex?: number | null;
}

const clockAt = (deck: DeckClock, pos: number) => deck.startCtx + (pos - deck.offset) / (deck.rate || 1);
const posAt = (deck: DeckClock, t: number) => deck.offset + (t - deck.startCtx) * (deck.rate || 1);

/** The downbeat indexes that start a phrase of `bars` (4 or 8) counted from the landed hook. */
function phraseStarts(song: LoopSong, bars: number): number[] {
  const landed = song.landedDownbeatIndex;
  const n = song.analysis.downbeats.length;
  if (landed == null) return [];
  const out: number[] = [];
  for (let k = landed % bars; k + bars < n; k += bars) out.push(k);
  return out;
}

/**
 * The phrase of `bars` that starts on the song's first 4-bar boundary at or after `after` (context time): it plays
 * through once, then repeats.
 * @returns null without a landed hook to count from, or when the song has no such phrase left
 */
export function nextPhraseLoop(song: LoopSong, after: number, bars = 4): PhraseLoop | null {
  const downbeats = song.analysis.downbeats;
  const from = posAt(song.deck, after);
  const start = phraseStarts(song, bars).find((k) => downbeats[k] >= from);
  return start == null ? null : { fromSec: downbeats[start], toSec: downbeats[start + bars], fromIndex: start, bars };
}

/**
 * The phrase of `bars` the song is in at its first downbeat at or after `after` (context time), and that downbeat's
 * index: Suspense builds from that bar on, and the phrase repeats from its end.
 * @returns null without a landed hook to count from, or when the song has no such phrase left
 */
export function currentPhraseLoop(song: LoopSong, after: number, bars = 4): { phrase: PhraseLoop; downbeat: number } | null {
  const downbeats = song.analysis.downbeats;
  const from = posAt(song.deck, after);
  const downbeat = downbeats.findIndex((d) => d >= from - 1e-9);
  if (downbeat < 0) return null;
  const start = phraseStarts(song, bars).filter((k) => k <= downbeat && downbeat < k + bars).at(-1);
  return start == null ? null : { phrase: { fromSec: downbeats[start], toSec: downbeats[start + bars], fromIndex: start, bars }, downbeat };
}

/**
 * The song's last full phrase that ends at least `tailSec` before the song does (its outro and fade stay out),
 * 8 bars when one fits after `after`, else 4. It plays through once, then repeats.
 * @returns null when no phrase fits between `after` and the tail
 */
export function lastPhraseLoop(song: LoopSong, after: number, tailSec: number): PhraseLoop | null {
  const downbeats = song.analysis.downbeats;
  const from = posAt(song.deck, after);
  const until = song.analysis.source.durationSec - tailSec;
  for (const bars of [8, 4]) {
    const fits = phraseStarts(song, bars).filter((k) => downbeats[k] >= from && downbeats[k + bars] <= until);
    const start = fits.at(-1);
    if (start != null) return { fromSec: downbeats[start], toSec: downbeats[start + bars], fromIndex: start, bars };
  }
  return null;
}

/**
 * The song's last 4 bars before its tail, when no whole phrase fits (D239: a song left playing never hands over to
 * other music by itself): the latest 4 bars that end by `tailSec` before the song does, and after `after`, so the
 * deck reaches their end ahead and jumps back from there. They may have started already.
 * @returns null when the song is already past its last 4 bars before the tail, or has fewer than 5 downbeats
 */
export function lastBarsLoop(song: { analysis: Analysis; deck: DeckClock }, after: number, tailSec: number, bars = 4): PhraseLoop | null {
  const downbeats = song.analysis.downbeats;
  const from = posAt(song.deck, after);
  const until = song.analysis.source.durationSec - tailSec;
  for (let k = downbeats.length - 1 - bars; k >= 0; k--) {
    const toSec = downbeats[k + bars];
    if (toSec > until) continue;
    return toSec >= from ? { fromSec: downbeats[k], toSec, fromIndex: k, bars } : null;
  }
  return null;
}

/** When the deck first reaches the loop's end (its first repeat starts there). */
export const firstRepeatAt = (deck: DeckClock, loop: PhraseLoop): number => clockAt(deck, loop.toSec);

/** One pass of the loop on the context clock. */
export const loopSeconds = (deck: DeckClock, loop: PhraseLoop): number => (loop.toSec - loop.fromSec) / (deck.rate || 1);
