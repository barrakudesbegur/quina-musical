// The Check's ✗ ("not landed"): a short "broken record", synthesized so it needs no sample file. A needle
// scratch, the record skipping on the same groove three times, then a tape-stop groan. About a second.
import { noiseBuffer } from './clicks.ts';

const EPS = 0.0001;

export interface BrokenRecordOptions {
  t0: number;
  /** Total length (the last skip and the groan fit inside it). */
  durationSec?: number;
  levelDb?: number;
}

export function brokenRecord(ctx: BaseAudioContext, destination: AudioNode, { t0, durationSec = 1.1, levelDb = -8 }: BrokenRecordOptions): void {
  const out = ctx.createGain();
  out.gain.value = 10 ** (levelDb / 20);
  out.connect(destination);
  const end = t0 + Math.max(0.5, durationSec);

  // The needle scratch: noise through a band-pass that wobbles down and back up, like a hand on the record.
  const scratch = ctx.createBufferSource();
  scratch.buffer = noiseBuffer(ctx, 1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(2600, t0);
  bp.frequency.exponentialRampToValueAtTime(500, t0 + 0.07);
  bp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.15);
  const scratchGain = ctx.createGain();
  scratchGain.gain.setValueAtTime(EPS, t0);
  scratchGain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.01);
  scratchGain.gain.exponentialRampToValueAtTime(EPS, t0 + 0.18);
  scratch.connect(bp).connect(scratchGain).connect(out);
  scratch.start(t0, Math.random() * 0.5);
  scratch.stop(t0 + 0.2);

  // The skip: the same short buzzy groove three times, each a little lower and shorter, with a click.
  const skipAt = t0 + 0.2;
  const skipSpan = Math.min(0.48, end - skipAt - 0.3);
  for (let k = 0; k < 3; k++) {
    const t = skipAt + (k * skipSpan) / 3;
    const len = (skipSpan / 3) * 0.8;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330 / (1 + 0.18 * k), t);
    osc.frequency.linearRampToValueAtTime(300 / (1 + 0.18 * k), t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.006);
    g.gain.setValueAtTime(0.35, t + len * 0.8);
    g.gain.exponentialRampToValueAtTime(EPS, t + len);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.02);
    const click = ctx.createBufferSource();
    click.buffer = noiseBuffer(ctx, 1);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.5, t);
    cg.gain.exponentialRampToValueAtTime(EPS, t + 0.015);
    click.connect(cg).connect(out);
    click.start(t, Math.random() * 0.5);
    click.stop(t + 0.02);
  }

  // The groan: the record slows to a stop, pitch and low-pass falling together.
  const groanAt = skipAt + skipSpan;
  const groan = ctx.createOscillator();
  groan.type = 'square';
  groan.frequency.setValueAtTime(220, groanAt);
  groan.frequency.exponentialRampToValueAtTime(38, end);
  const glp = ctx.createBiquadFilter();
  glp.type = 'lowpass';
  glp.frequency.setValueAtTime(1400, groanAt);
  glp.frequency.exponentialRampToValueAtTime(160, end);
  const gg = ctx.createGain();
  gg.gain.setValueAtTime(EPS, groanAt);
  gg.gain.exponentialRampToValueAtTime(0.3, groanAt + 0.02);
  gg.gain.exponentialRampToValueAtTime(EPS, end);
  groan.connect(glp).connect(gg).connect(out);
  groan.start(groanAt);
  groan.stop(end + 0.02);
}
