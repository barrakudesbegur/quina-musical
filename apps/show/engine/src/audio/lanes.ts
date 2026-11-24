// Pure helpers for P1 stem lanes and P2 slices, kept apart from deck.ts so Node tests can run them.
//
// Sample-exact subtraction. A deck's main source is started on a whole sample frame with a whole-frame
// offset (`frameAligned`), and every lane is too, so a lane reads its stem at exactly the frame the main
// source reads the mix: mix − 2·drums then cancels the drums to float precision (tests/lanes.test.ts and
// test.html check the residual). The stems are stored at `stemGain` scale (half), so a part at full scale
// is the stored stem × `scale` (= 1 / stemGain); `other` is the mix minus the three stems.
import type { LanePart, LanePoints, StemName } from '../plan/events.ts';

/** A start that sits a hair before a whole frame, so the engine's rounding (round or ceil) lands on that frame. */
const FRAME_EPS = 1e-6;

/**
 * Where to start a source so it plays from a whole sample frame of its buffer on a whole frame of the
 * context: within a frame of the asked `when`/`offset` (21 µs at 48 kHz), keeping where the song sits in time.
 * Only for rate 1 (a resampled source has no fixed frame relation).
 */
export function frameAligned(when: number, offset: number, sampleRate: number): { when: number; offset: number } {
  const frame = Math.round(when * sampleRate);
  // The song position that should sound at that frame, rounded to a whole frame of the buffer.
  const pos = Math.round((offset + (frame / sampleRate - when)) * sampleRate);
  return { when: (frame - FRAME_EPS) / sampleRate, offset: Math.max(0, pos) / sampleRate };
}

/**
 * Where a lane starts so it reads the same song frame the main source plays (both on whole frames): the main
 * source started at context frame `startFrame` from song frame `offsetFrame`; a lane wanted at `at` starts
 * on the frame `frame` (at `when`) and reads its buffer from `offsetFrames`, the song frame then minus where its
 * buffer starts in the song (`bufferStartFrame`; 0 for the mix itself).
 */
export function laneStart(startFrame: number, offsetFrame: number, at: number, sampleRate: number, bufferStartFrame: number): { frame: number; when: number; offsetFrames: number } {
  const frame = Math.round(at * sampleRate);
  return { frame, when: (frame - FRAME_EPS) / sampleRate, offsetFrames: offsetFrame + (frame - startFrame) - bufferStartFrame };
}

/** One buffer a lane plays, with the gain that turns it into its share of the part (at full scale). */
export interface LaneSource {
  from: 'mix' | StemName;
  gain: number;
}

const STEM_NAMES: readonly StemName[] = ['drums', 'bass', 'vocals'];

/**
 * The buffers that make up one part: a stored stem × scale, or `other` = mix − scale·(drums + bass + vocals).
 * @param scale  1 / stemGain
 */
export function laneSources(part: LanePart, scale: number): LaneSource[] {
  if (part !== 'other') return [{ from: part, gain: scale }];
  return [{ from: 'mix', gain: 1 }, ...STEM_NAMES.map((name) => ({ from: name, gain: -scale }))];
}

/** The automation calls an AudioParam receives (a fake one in tests). */
export interface ParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}

/** The value of breakpoints at `t`: linear between points, held before the first and after the last. */
export function pointsAt(points: LanePoints, t: number): number {
  if (!points.length) return 0;
  if (t <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) {
    const [t1, v1] = points[k];
    if (t <= t1) {
      const [t0, v0] = points[k - 1];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return points[points.length - 1][1];
}

/**
 * Schedules breakpoints on a param over [start, until]: their value at `start`, every later point, then a
 * `cutSec` ramp to 0 that ends at `until`.
 */
export function schedulePoints(param: ParamLike, points: LanePoints, start: number, until: number, cutSec = 0.005): void {
  const cutFrom = Math.max(start, until - cutSec);
  param.setValueAtTime(pointsAt(points, start), start);
  for (const [t, v] of points) if (t > start && t < cutFrom) param.linearRampToValueAtTime(v, t);
  param.linearRampToValueAtTime(pointsAt(points, cutFrom), cutFrom);
  param.linearRampToValueAtTime(0, Math.max(until, cutFrom + 0.001));
}

/** Short-term RMS over `win` frames from `at` (mono mix of the channels). */
function rmsAt(channels: readonly Float32Array[], at: number, win: number): number {
  let sum = 0;
  let n = 0;
  for (const data of channels) {
    for (let k = at; k < Math.min(data.length, at + win); k++) {
      sum += data[k] * data[k];
      n++;
    }
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/** Zero crossings per frame over `win` frames from `at` (first channel): high for noise-like consonants. */
function crossingsAt(data: Float32Array, at: number, win: number): number {
  let count = 0;
  const end = Math.min(data.length - 1, at + win);
  for (let k = at; k < end; k++) if ((data[k] >= 0) !== (data[k + 1] >= 0)) count++;
  return count / Math.max(1, end - at);
}

/**
 * P2's onset snap: from `fromSec`, the first point within `searchSec` whose 5 ms RMS reaches a quarter of
 * the loudest one there, then past at most `consonantSec` of noise-like signal (many zero crossings), so a
 * chop starts on the syllable's vowel.
 * @returns seconds to add to the offset (0 when nothing is found)
 */
export function onsetShift(channels: readonly Float32Array[], sampleRate: number, fromSec: number, searchSec: number, consonantSec: number): number {
  const win = Math.max(1, Math.round(0.005 * sampleRate));
  const from = Math.max(0, Math.round(fromSec * sampleRate));
  const to = from + Math.round(searchSec * sampleRate);
  let peak = 0;
  for (let k = from; k < to; k += win) peak = Math.max(peak, rmsAt(channels, k, win));
  if (peak <= 0) return 0;
  let onset = from;
  while (onset < to && rmsAt(channels, onset, win) < peak / 4) onset += win;
  if (onset >= to) return 0;
  const maxSkip = onset + Math.round(consonantSec * sampleRate);
  let vowel = onset;
  while (vowel < maxSkip && channels[0] && crossingsAt(channels[0], vowel, win) > 0.25) vowel += win;
  return (vowel - from) / sampleRate;
}
