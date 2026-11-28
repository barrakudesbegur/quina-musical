// A Check's revealed song (D107): it starts at its hook's pickup and plays on until the next reveal, a step back or
// the Check's end; near its end it repeats its last phrase, as a song left playing does anywhere else (D239,
// plan/loop.ts). Pure: where the audio dies (its tail measured on the decoded buffer), the loop, how far into a pass a
// late start goes, and when the snippet can hand over to the full song. audio/check.ts plays it.
import { lastBarsLoop, lastPhraseLoop } from './loop.ts';
import type { Analysis } from '../analysis.ts';

/** A looping buffer, in its own seconds: the first pass plays from `startSec` (the pickup), every pass reaches `outSec`
 * and the next one plays from `fromSec`, fading in over the outgoing pass's last `xfadeSec` (equal power). */
export interface CheckLoop {
  startSec: number;
  fromSec: number;
  outSec: number;
  xfadeSec: number;
}

export interface TailOptions {
  /** The reference: the hook, from its pickup, this long. */
  refStartSec: number;
  refSec: number;
  /** The RMS windows the tail is measured in. */
  windowSec: number;
  /** The audio counts as dead once it stays this far under the reference (dB, negative). */
  dropDb: number;
}

const meanSquare = (channels: readonly Float32Array[], from: number, to: number): number => {
  let sum = 0;
  let n = 0;
  for (const data of channels) {
    const end = Math.min(to, data.length);
    for (let i = Math.max(0, from); i < end; i++) sum += data[i] * data[i];
    n += Math.max(0, end - Math.max(0, from));
  }
  return n ? sum / n : 0;
};

/**
 * Where the song's audio dies (seconds): the end of the last window, counted from the end, whose RMS is within
 * `dropDb` of the hook's. Trailing silence and the quiet end of a fade-out stay out, so a loop jumps back while the
 * song is still loud. It only reads the tail (and the reference), so it is cheap on a whole song. A song that is never
 * that loud after its hook ends where the reference does.
 */
export function audibleEndSec(channels: readonly Float32Array[], sampleRate: number, { refStartSec, refSec, windowSec, dropDb }: TailOptions): number {
  const length = channels.reduce((n, c) => Math.max(n, c.length), 0);
  const refFrom = Math.round(refStartSec * sampleRate);
  const refTo = Math.min(length, refFrom + Math.round(refSec * sampleRate));
  const threshold = meanSquare(channels, refFrom, refTo) * 10 ** (dropDb / 10);
  const win = Math.max(1, Math.round(windowSec * sampleRate));
  for (let to = length; to - win >= refTo; to -= win) {
    if (meanSquare(channels, to - win, to) >= threshold) return to / sampleRate;
  }
  return refTo / sampleRate;
}

export interface SongLoopOptions {
  analysis: Analysis;
  /** The hook's pickup: the first pass starts here. */
  startSec: number;
  /** The hook's downbeat index: phrases count from it (as from a landed hook). Null: none known. */
  hookDownbeatIndex: number | null;
  /** Where the audio dies (audibleEndSec). */
  audibleEndSec: number;
  /** LOOP.stayTailSec: the loop ends at least this long before the song does, as Aguanta's. */
  stayTailSec: number;
  /** The phrase loop's crossfade (LOOP.fadeSec: a click guard on the downbeat, as Aguanta's). */
  phraseXfadeSec: number;
  /** The crossfade back to the pickup when the song has no phrase to loop. */
  pickupXfadeSec: number;
}

/**
 * The loop of a revealed song, the same as a song left playing anywhere else (D239, plan/loop.ts): from the hook's
 * pickup it plays on into its last full phrase (8 bars, else 4, counted from the hook) that ends before its tail, and
 * repeats that phrase, else its last 4 bars. The tail is `stayTailSec`, or longer when the audio dies earlier (a long
 * fade, trailing silence), so the loop never jumps out of the quiet. Only a song with no such bars (no beat grid) jumps
 * back to its pickup instead (pickupLoop).
 */
export function songLoop({ analysis, startSec, hookDownbeatIndex, audibleEndSec, stayTailSec, phraseXfadeSec, pickupXfadeSec }: SongLoopOptions): CheckLoop {
  const tailSec = Math.max(stayTailSec, analysis.source.durationSec - audibleEndSec);
  const deck = { startCtx: 0, offset: 0, rate: 1 };
  const phrase = lastPhraseLoop({ analysis, deck, landedDownbeatIndex: hookDownbeatIndex }, startSec, tailSec) ?? lastBarsLoop({ analysis, deck }, startSec, tailSec);
  if (phrase) return { startSec, fromSec: phrase.fromSec, outSec: phrase.toSec, xfadeSec: phraseXfadeSec };
  return pickupLoop({ startSec, endSec: Math.min(audibleEndSec, analysis.source.durationSec), xfadeSec: pickupXfadeSec });
}

/**
 * The loop back to the pickup (a snippet, or a song with no beat grid): each pass plays from `startSec` until `endSec`
 * (where its usable audio ends), the next one fading in over the outgoing pass's last `xfadeSec`. Never shorter than one
 * crossfade.
 */
export function pickupLoop({ startSec, endSec, xfadeSec }: { startSec: number; endSec: number; xfadeSec: number }): CheckLoop {
  return { startSec, fromSec: startSec, outSec: Math.max(startSec + 2 * xfadeSec, endSec), xfadeSec };
}

/**
 * Where a voice that should have started at its reveal starts in its buffer when it starts `lateSec` after it: as far
 * into the pass as the reveal is old, so it stays in time with the screens, unless that leaves less than `minAheadSec`
 * before the jump: then from the pickup.
 */
export function entryOffset(loop: CheckLoop, lateSec: number, minAheadSec: number): number {
  const offset = loop.startSec + Math.max(0, lateSec);
  return offset <= loop.outSec - minAheadSec ? offset : loop.startSec;
}

/** The first audio frame at or after `t` (seconds), so voices that must line up start on whole samples. */
export function atFrame(t: number, sampleRate: number): number {
  return Math.ceil(t * sampleRate - 1e-6) / sampleRate;
}

/** A voice on the audio clock: from `at` it plays its buffer from `offsetSec`, and its buffer's 0 is `originSec` in the
 * song (the snippet's pickup, or 0 for the song itself). */
export interface VoiceClock {
  at: number;
  offsetSec: number;
  originSec: number;
}

/** The song second that voice plays at context time `t`. */
export function songSecAt(voice: VoiceClock, t: number): number {
  return voice.originSec + voice.offsetSec + (t - voice.at);
}

/**
 * When the snippet hands over to the full song: the first frame `leadSec` from now, once the snippet is at its level
 * (`voiceAt`), so long as the handover's crossfade ends by `outAt` (where the snippet's own pass starts fading out).
 * Null: too late in this pass; the next pass is the song's.
 */
export function handoverAt({ now, voiceAt, outAt, leadSec, xfadeSec, sampleRate }: { now: number; voiceAt: number; outAt: number; leadSec: number; xfadeSec: number; sampleRate: number }): number | null {
  const at = atFrame(Math.max(now + leadSec, voiceAt), sampleRate);
  return at + xfadeSec <= outAt ? at : null;
}

/** An equal-power crossfade's two gain curves, `points` long, scaled to `level`: the outgoing voice's and the incoming's. */
export function equalPowerCurves(level: number, points: number): { out: Float32Array; in: Float32Array } {
  const out = new Float32Array(points);
  const inc = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = points > 1 ? i / (points - 1) : 1;
    out[i] = level * Math.cos((x * Math.PI) / 2);
    inc[i] = level * Math.sin((x * Math.PI) / 2);
  }
  return { out, in: inc };
}

/**
 * The snippet's exact start in the song: the index rounds its pickup to 0.1 ms, a few samples off, and the handover
 * plays both together. The lag within ±`searchFrames` frames of `startSec` where the snippet's samples (from
 * `fromSec` in, past its fade-in, `lengthSec` of them) best match the song's.
 */
export function snippetStartSec(snippet: Float32Array, song: Float32Array, sampleRate: number, startSec: number, { searchFrames = 8, fromSec = 0.1, lengthSec = 0.05 } = {}): number {
  const base = Math.round(startSec * sampleRate);
  const from = Math.round(fromSec * sampleRate);
  const n = Math.min(Math.round(lengthSec * sampleRate), snippet.length - from);
  let best = 0;
  let bestError = Infinity;
  for (let lag = -searchFrames; lag <= searchFrames; lag++) {
    const at = base + lag + from;
    if (at < 0 || at + n > song.length || n <= 0) continue;
    let error = 0;
    for (let i = 0; i < n; i++) {
      const d = snippet[from + i] - song[at + i];
      error += d * d;
    }
    if (error < bestError) {
      bestError = error;
      best = lag;
    }
  }
  return (base + best) / sampleRate;
}
