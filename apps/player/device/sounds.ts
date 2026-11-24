// Interface sounds, synthesised in WebAudio: no files to download. Per the sound map (ui/ANIMATIONS.md):
// - short blips (under 200 ms; the celebration blip 0.8 s), quiet (−24 dBFS peak);
// - never more than one at a time, never while the page is hidden;
// - ON by default (Admin may change the default; the player's own choice wins).
// Browsers start audio only after a user gesture, so `unlock()` runs on the first tap.
import { PLAYER_CONFIG } from '../config.ts';
import type { Cue } from '../logic/feedback.ts';

export type Blip = Cue | 'tap' | 'tick';

/** A note: frequency (Hz), start and length (s) within the blip, waveform. */
type Note = [freq: number, at: number, len: number, wave?: OscillatorType];

const BLIPS: Record<Blip, Note[]> = {
  tap: [[880, 0, 0.04]],
  tick: [[1400, 0, 0.012, 'square']],
  landing: [
    [520, 0, 0.05],
    [780, 0.04, 0.08],
  ],
  mark: [[300, 0, 0.06, 'triangle']],
  nearWin: [
    [660, 0, 0.08],
    [990, 0.09, 0.1],
  ],
  celebrate: [
    [523, 0, 0.12],
    [659, 0.12, 0.12],
    [784, 0.24, 0.12],
    [1047, 0.36, 0.44],
  ],
};

type AudioContextCtor = new () => AudioContext;

export class Sounds {
  enabled = true;
  private ctx: AudioContext | null = null;
  private busyUntil = 0;
  private readonly Ctor: AudioContextCtor | null;

  constructor() {
    const legacy = typeof window === 'undefined' ? undefined : (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    this.Ctor = typeof AudioContext !== 'undefined' ? AudioContext : (legacy ?? null);
  }

  get supported(): boolean {
    return this.Ctor !== null;
  }

  /** Create or resume the audio context. Call from a user gesture (a tap). */
  unlock(): void {
    if (!this.Ctor) return;
    try {
      this.ctx ??= new this.Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(blip: Blip): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const now = ctx.currentTime;
    // One at a time: a tick may be dropped, anything else waits for nothing and is simply skipped.
    if (now < this.busyUntil) return;
    const notes = BLIPS[blip];
    let end = now;
    for (const [freq, at, len, wave = 'sine'] of notes) {
      const start = now + at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(PLAYER_CONFIG.soundPeakGain, start + Math.min(0.01, len / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + len + 0.02);
      end = Math.max(end, start + len);
    }
    this.busyUntil = end;
  }
}
