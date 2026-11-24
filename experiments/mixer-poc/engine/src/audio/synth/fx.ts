// Procedural build-up layers, generated at the incoming song's tempo and scheduled on the audio clock:
// noise riser, accelerating snare roll, reverse-cymbal swell, sub impact, heartbeat kick, tape-stop
// sweep. Levels are relative to music normalized at −14 LUFS; tune by ear.
import { noiseBuffer } from './clicks.ts';
import type { SynthName, SynthParams } from '../../plan/recipes.ts';

const EPS = 0.0001;
const dbToGain = (db: number) => 10 ** (db / 20);

function gainNode(ctx: BaseAudioContext, destination: AudioNode, value = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(destination);
  return g;
}

function noiseSource(ctx: BaseAudioContext): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 4);
  src.loop = true;
  return src;
}

// White-noise riser through a band-pass sweeping fromHz → toHz, plus a detuned saw rising an octave.
export interface RiserOptions {
  t0: number;
  t1: number;
  fromHz?: number;
  toHz?: number;
  fromDb?: number;
  toDb?: number;
  tone?: boolean;
}

export function riser(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { t0, t1, fromHz = 800, toHz = 10000, fromDb = -30, toDb = -8, tone = true }: RiserOptions,
): void {
  const out = gainNode(ctx, destination, 0);
  out.gain.setValueAtTime(dbToGain(fromDb), t0);
  out.gain.exponentialRampToValueAtTime(dbToGain(toDb), t1);
  out.gain.setValueAtTime(EPS, t1 + 0.01);

  const noise = noiseSource(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(fromHz, t0);
  bp.frequency.exponentialRampToValueAtTime(toHz, t1);
  noise.connect(bp).connect(out);
  noise.start(t0, Math.random() * 2);
  noise.stop(t1 + 0.05);

  if (tone) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t0);
    lp.frequency.exponentialRampToValueAtTime(6000, t1);
    const toneGain = gainNode(ctx, out, 0.35);
    lp.connect(toneGain);
    for (const detune of [-12, 12]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(110, t0);
      osc.frequency.exponentialRampToValueAtTime(440, t1);
      osc.connect(lp);
      osc.start(t0);
      osc.stop(t1 + 0.05);
    }
  }
}

// One snare: a short triangle body plus band-passed noise; `pitch` in semitones, `hpHz` thins it.
export function snare(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { level = 0.5, pitch = 0, hpHz = 150 }: { level?: number; pitch?: number; hpHz?: number } = {},
): void {
  const ratio = 2 ** (pitch / 12);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = hpHz;
  hp.connect(destination);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(220 * ratio, time);
  body.frequency.exponentialRampToValueAtTime(160 * ratio, time + 0.05);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(EPS, time);
  bodyGain.gain.exponentialRampToValueAtTime(level * 0.7, time + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(EPS, time + 0.06);
  body.connect(bodyGain).connect(hp);
  body.start(time);
  body.stop(time + 0.08);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 * ratio;
  bp.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(EPS, time);
  noiseGain.gain.exponentialRampToValueAtTime(level, time + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(EPS, time + 0.16);
  noise.connect(bp).connect(noiseGain).connect(hp);
  noise.start(time, Math.random() * 0.5);
  noise.stop(time + 0.2);
}

// Snare roll in four equal stages at 1/4, 1/8, 1/16, 1/32 notes (relative to `beat`), velocity and pitch
// rising, high-pass rising. Hits sit on the incoming song's grid: t0 must be one of its beats.
export interface SnareRollOptions {
  t0: number;
  t1: number;
  beat: number;
  pitchTo?: number;
  velFrom?: number;
  velTo?: number;
  stages?: readonly number[];
}

// Returns the number of hits.
export function snareRoll(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { t0, t1, beat, pitchTo = 7, velFrom = 55, velTo = 120, stages = [1, 0.5, 0.25, 0.125] }: SnareRollOptions,
): number {
  const span = t1 - t0;
  if (span <= 0) return 0;
  let count = 0;
  const stageLen = span / stages.length;
  for (let s = 0; s < stages.length; s++) {
    const step = stages[s] * beat;
    const start = t0 + s * stageLen;
    const end = t0 + (s + 1) * stageLen;
    for (let time = start; time < end - 1e-6; time += step) {
      const p = (time - t0) / span;
      const velocity = velFrom + (velTo - velFrom) * p;
      snare(ctx, destination, time, {
        level: 0.55 * (velocity / 127) ** 1.6,
        pitch: pitchTo * p,
        hpHz: 150 * (10 ** p),
      });
      count++;
    }
  }
  return count;
}

// Reverse cymbal: high-passed noise swelling exponentially and cut at `t1` (the hit or the gap).
export function swell(ctx: BaseAudioContext, destination: AudioNode, { t0, t1, peakDb = -10 }: { t0: number; t1: number; peakDb?: number }): void {
  const out = gainNode(ctx, destination, 0);
  out.gain.setValueAtTime(EPS, t0);
  out.gain.exponentialRampToValueAtTime(dbToGain(peakDb), t1);
  out.gain.setValueAtTime(EPS, t1 + 0.005);
  const noise = noiseSource(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4000;
  const shelf = ctx.createBiquadFilter();
  shelf.type = 'peaking';
  shelf.frequency.value = 9000;
  shelf.gain.value = 6;
  noise.connect(hp).connect(shelf).connect(out);
  noise.start(t0, Math.random() * 2);
  noise.stop(t1 + 0.02);
}

// Sub impact: 60→35 Hz sine drop with a noise crack, plus a long low tail.
export function impact(ctx: BaseAudioContext, destination: AudioNode, time: number, { level = 0.8 }: { level?: number } = {}): void {
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, time);
  sub.frequency.exponentialRampToValueAtTime(32, time + 0.9);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(EPS, time);
  subGain.gain.exponentialRampToValueAtTime(level, time + 0.004);
  subGain.gain.exponentialRampToValueAtTime(EPS, time + 1.2);
  sub.connect(subGain).connect(destination);
  sub.start(time);
  sub.stop(time + 1.3);

  const crack = ctx.createBufferSource();
  crack.buffer = noiseBuffer(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(8000, time);
  lp.frequency.exponentialRampToValueAtTime(300, time + 0.4);
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(EPS, time);
  crackGain.gain.exponentialRampToValueAtTime(level * 0.6, time + 0.002);
  crackGain.gain.exponentialRampToValueAtTime(EPS, time + 0.5);
  crack.connect(lp).connect(crackGain).connect(destination);
  crack.start(time);
  crack.stop(time + 0.55);
}

// Heartbeat kick (power-down suspense).
export function kick(ctx: BaseAudioContext, destination: AudioNode, time: number, { level = 0.5 }: { level?: number } = {}): void {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(EPS, time);
  g.gain.exponentialRampToValueAtTime(level, time + 0.003);
  g.gain.exponentialRampToValueAtTime(EPS, time + 0.35);
  osc.connect(g).connect(destination);
  osc.start(time);
  osc.stop(time + 0.4);
}

// Falling filtered-noise sweep that sells a tape stop / power-down.
export function downlifter(ctx: BaseAudioContext, destination: AudioNode, { t0, t1, peakDb = -14 }: { t0: number; t1: number; peakDb?: number }): void {
  const out = gainNode(ctx, destination, 0);
  out.gain.setValueAtTime(dbToGain(peakDb), t0);
  out.gain.exponentialRampToValueAtTime(EPS, t1);
  const noise = noiseSource(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2;
  bp.frequency.setValueAtTime(6000, t0);
  bp.frequency.exponentialRampToValueAtTime(150, t1);
  noise.connect(bp).connect(out);
  noise.start(t0, Math.random() * 2);
  noise.stop(t1 + 0.02);
}

/** One synth voice as a plan's synth event plays it (recipes.ts SynthParams). */
export type SynthVoice<N extends SynthName> = (ctx: BaseAudioContext, destination: AudioNode, params: SynthParams[N]) => void;

export const SYNTHS: { [N in SynthName]: SynthVoice<N> } = {
  riser: (ctx, dest, p) => riser(ctx, dest, p),
  snareRoll: (ctx, dest, p) => snareRoll(ctx, dest, p),
  swell: (ctx, dest, p) => swell(ctx, dest, p),
  impact: (ctx, dest, p) => impact(ctx, dest, p.at, p),
  kicks: (ctx, dest, p) => p.times.forEach((t) => kick(ctx, dest, t, p)),
  downlifter: (ctx, dest, p) => downlifter(ctx, dest, p),
};
