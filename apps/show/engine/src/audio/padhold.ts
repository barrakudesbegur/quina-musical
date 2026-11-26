// The effects held on the D-pad (D203). The drum roll: snare hits on the music's beat (the engine gives the grid), denser
// and louder as the shakes raise its intensity (DRUMROLL.perBeat, levelDb), scheduled a little ahead on the audio clock
// by the runtime's tick. Let go long enough, it stops at the next beat with a hit (DRUMROLL.hit); sooner, it fades out.
import type { AudioGraph } from './graph.ts';
import { DRUMROLL } from '../config.ts';

const AHEAD_SEC = 0.12;

export class DrumRoll {
  readonly graph: AudioGraph;
  private grid: { t0: number; beatSec: number } | null = null;
  private intensity = 0;
  /** The next hit not yet scheduled (audio clock). */
  private nextAt = 0;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor(graph: AudioGraph) {
    this.graph = graph;
  }

  start(at: number, grid: { t0: number; beatSec: number }, intensity: number): void {
    this.stopNow();
    const { ctx } = this.graph;
    this.grid = grid;
    this.intensity = intensity;
    this.out = ctx.createGain();
    this.out.connect(this.graph.vol.padFx);
    this.nextAt = this.snap(Math.max(at, ctx.currentTime + 0.01));
    void this.graph.loadSamples([DRUMROLL.hit]);
  }

  setIntensity(intensity: number): void {
    this.intensity = intensity;
  }

  /** Let go: a hit at `at` (a beat) and the roll stops there; or it fades out from `at`. */
  release(at: number, land: boolean): void {
    const out = this.out;
    if (!out) return;
    const { ctx } = this.graph;
    const t = Math.max(at, ctx.currentTime);
    this.grid = null;
    if (land) {
      this.graph.playSample(DRUMROLL.hit, t, DRUMROLL.hitDb, this.graph.vol.padFx);
      out.gain.setValueAtTime(1, t - 0.005);
      out.gain.linearRampToValueAtTime(0, t + 0.01);
    } else {
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + DRUMROLL.fadeSec);
    }
    setTimeout(() => out.disconnect(), (t - ctx.currentTime + DRUMROLL.fadeSec + 0.5) * 1000);
    this.out = null;
  }

  stopNow(): void {
    if (this.out) this.release(this.graph.ctx.currentTime, false);
  }

  /** Schedule the hits due in the next moment (the runtime's tick). */
  tick(now: number): void {
    const grid = this.grid;
    const out = this.out;
    if (!grid || !out) return;
    const step = grid.beatSec / this.perBeat();
    while (this.nextAt < now + AHEAD_SEC) {
      this.hit(this.nextAt, out);
      this.nextAt += step;
    }
  }

  private perBeat(): number {
    const [lo, hi] = DRUMROLL.perBeat;
    return this.intensity >= 0.5 ? hi : lo;
  }

  /** The first subdivision of the grid at or after `t`. */
  private snap(t: number): number {
    const grid = this.grid!;
    const step = grid.beatSec / this.perBeat();
    return grid.t0 + Math.ceil((t - grid.t0) / step) * step;
  }

  /** One snare hit: a short band-passed noise burst. */
  private hit(at: number, out: AudioNode): void {
    const { ctx } = this.graph;
    this.noise ??= (() => {
      const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.2), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    })();
    const [lo, hi] = DRUMROLL.levelDb;
    const level = 10 ** ((lo + (hi - lo) * this.intensity) / 20);
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    source.connect(band).connect(env).connect(out);
    source.start(at);
    source.stop(at + 0.12);
  }
}
