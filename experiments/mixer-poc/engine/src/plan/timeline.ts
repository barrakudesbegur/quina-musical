// Pure helpers mapping a song's analysis timeline (seconds in mix.flac) to the audio context clock.
import type { Analysis, Hook } from '../analysis.ts';

/**
 * Where a deck is in its song: the song position `offset` sounded at context time `startCtx`.
 * A missing or zero `rate` counts as 1.
 */
export interface DeckClock {
  startCtx: number;
  offset: number;
  rate?: number;
}

/** How a downbeat sits in the song's phrases, counted from the hook where it landed. */
export type PhraseClass = 'phrase8' | 'phrase4' | 'bar';

export interface TimelineDownbeat {
  index: number;
  pos: number;
  ctxTime: number;
}

/** A deck's song mapped onto the AudioContext clock (see `deckTimeline`). */
export interface Timeline {
  ctxAt: (pos: number) => number;
  posAt: (t: number) => number;
  bpb: number;
  durationSec: number;
  barAt: (index: number) => number;
  beatAt: (index: number) => number;
  downbeatsBetween: (t0: number, t1: number) => TimelineDownbeat[];
  phraseClass: (index: number) => PhraseClass;
}

/** B's grid around its hook, in seconds (bridges and gaps live on it). */
export interface HookGrid {
  bar: number;
  beat: number;
  bpb: number;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);
/** @returns dB, floored at −120 */
export const gainToDb = (gain: number): number => 20 * Math.log10(Math.max(gain, 1e-6));

/** @param landedDownbeatIndex  the hook downbeat this song landed on; phrases count from it */
export function deckTimeline(analysis: Analysis, deck: DeckClock, landedDownbeatIndex: number | null = null): Timeline {
  const { downbeats } = analysis;
  const rate = deck.rate || 1;
  const bpb = analysis.tempo?.beatsPerBar || 4;
  const ctxAt = (pos: number) => deck.startCtx + (pos - deck.offset) / rate;
  const posAt = (t: number) => deck.offset + (t - deck.startCtx) * rate;

  function barAt(index: number) {
    if (index > 0 && index < downbeats.length) return downbeats[index] - downbeats[index - 1];
    if (index + 1 < downbeats.length) return downbeats[index + 1] - downbeats[index];
    return analysis.tempo.barSecMedian;
  }

  return {
    ctxAt,
    posAt,
    bpb,
    durationSec: analysis.source.durationSec,
    barAt: (index) => barAt(index) / rate,
    beatAt: (index) => barAt(index) / bpb / rate,
    downbeatsBetween(t0, t1) {
      const p0 = posAt(t0);
      const p1 = posAt(t1);
      const out: TimelineDownbeat[] = [];
      for (let i = 0; i < downbeats.length; i++) {
        if (downbeats[i] < p0) continue;
        if (downbeats[i] > p1) break;
        out.push({ index: i, pos: downbeats[i], ctxTime: ctxAt(downbeats[i]) });
      }
      return out;
    },
    // Phrases are counted from the hook downbeat where this song landed (a chorus start by construction).
    phraseClass(index) {
      if (landedDownbeatIndex == null) return 'bar';
      const k = index - landedDownbeatIndex;
      if (k % 8 === 0) return 'phrase8';
      if (k % 4 === 0) return 'phrase4';
      return 'bar';
    },
  };
}

// Beat length of B around its hook (bridges and gaps live on B's grid).
export function hookGrid(analysis: Analysis, hook: Hook): HookGrid {
  const bpb = analysis.tempo?.beatsPerBar || 4;
  const bar = hook.barSecLocal || analysis.tempo.barSecMedian;
  return { bar, beat: bar / bpb, bpb };
}
