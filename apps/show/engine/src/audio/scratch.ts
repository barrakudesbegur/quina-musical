// P7, the scratch render (D19), pure so Node tests can run it. A turntable reads its record along the hand's
// position curve: forward, backward, still. Chrome cannot play a negative playbackRate, and an AudioWorklet would
// be a second audio thread to load and keep in sync; but a scratch is at most two beats long, so the Deck renders
// it into a buffer when the plan is applied (well under a millisecond of CPU per beat) and plays that.
import type { LanePoints, ScratchStroke } from '../plan/events.ts';
import { pointsAt } from './lanes.ts';

/**
 * Where the hand has the record at `t` (seconds of the source past the grain's start): eased strokes move like a
 * hand (still at both ends, fastest in the middle), a steady stroke at a constant speed; held before the first
 * stroke, between strokes and after the last.
 */
export function scratchPosition(strokes: readonly ScratchStroke[], t: number): number {
  if (!strokes.length) return 0;
  if (t <= strokes[0].t0) return strokes[0].p0;
  let held = strokes[0].p0;
  for (const s of strokes) {
    if (t < s.t0) return held;
    if (t <= s.t1) {
      const u = s.t1 > s.t0 ? (t - s.t0) / (s.t1 - s.t0) : 1;
      const k = s.ease ? (1 - Math.cos(Math.PI * u)) / 2 : u;
      return s.p0 + (s.p1 - s.p0) * k;
    }
    held = s.p1;
  }
  return held;
}

export interface ScratchRenderArgs {
  /** The source's channels (a Signature's file, or a vocal stem). */
  channels: readonly Float32Array[];
  sampleRate: number;
  /** The source frame (may be fractional) where the grain starts: position 0. */
  originFrame: number;
  strokes: readonly ScratchStroke[];
  /** The crossfader: the level's breakpoints, 0–1. */
  gate: LanePoints;
  /** Context time of the first rendered frame. */
  at: number;
  frames: number;
  /** Linear gain on everything (the scratch's level, a stem's scale). */
  gain: number;
  /** Needle noise per unit of the hand's speed (1 = the record at normal speed), linear. */
  noise: number;
  rng: () => number;
}

/**
 * The scratch: each output frame reads the source at the hand's position (linear interpolation, silence outside
 * the source), times the crossfader, plus needle noise that follows the hand's speed.
 * @returns one Float32Array per source channel, `frames` long
 */
export function renderScratch({ channels, sampleRate, originFrame, strokes, gate, at, frames, gain, noise, rng }: ScratchRenderArgs): Float32Array<ArrayBuffer>[] {
  const out = channels.map(() => new Float32Array(Math.max(0, frames)));
  let last = scratchPosition(strokes, at);
  for (let n = 0; n < frames; n++) {
    const t = at + n / sampleRate;
    const pos = scratchPosition(strokes, t);
    const speed = Math.abs(pos - last) * sampleRate;
    last = pos;
    const level = pointsAt(gate, t) * gain;
    if (level <= 0) continue;
    const x = originFrame + pos * sampleRate;
    const i = Math.floor(x);
    const frac = x - i;
    const hiss = noise > 0 ? noise * Math.min(speed, 3) * (rng() * 2 - 1) : 0;
    for (let c = 0; c < channels.length; c++) {
      const data = channels[c];
      const a = i >= 0 && i < data.length ? data[i] : 0;
      const b = i + 1 >= 0 && i + 1 < data.length ? data[i + 1] : 0;
      out[c][n] = level * (a + (b - a) * frac + hiss);
    }
  }
  return out;
}
