// The phone's sounds, two kinds sharing one audio context and one switch (ANIMATIONS.md › Sound map; U184):
// - **game cues**, synthesised in WebAudio, for what the show does: short blips (under 200 ms; the celebration blip
//   0.8 s), quiet (−24 dBFS peak), never more than one at a time;
// - **touch sounds** (D206-D208), recorded clicks for this phone's own taps, from the trimmed sprite in
//   packages/ui/sounds/ (packages/ui/sounds/sprite-player.ts). A cue always wins: touches are skipped while one plays.
// Neither plays while the page is hidden, nor on the show laptop (D207: its output is the PA). ON by default (Admin
// may change the default; the player's own choice wins). Browsers start audio only after a user gesture, so
// `unlock()` runs on the first tap; that tap may be silent.
import { PLAYER_CONFIG } from '../config.ts';
import type { Cue } from '../logic/feedback.ts';
import { isShowLaptop, mayPlay } from '../../../packages/ui/sounds/logic.ts';
import { SpritePlayer, useAmbientAudioSession } from '../../../packages/ui/sounds/sprite-player.ts';
import { SPRITES } from '../../../packages/ui/sounds/sprites.ts';
import type { TouchSounds } from '../../../packages/ui/sounds/touch.ts';
import type { TouchClass, TouchVariant } from '../../../packages/ui/sounds/types.ts';
import spriteUrl from '../../../packages/ui/sounds/player.mp3?url';

/** The game cues ("cue" is the Shuffle's and the stand-up's blip; "tick" the reel's; "added" a card saved on the pad). */
export type Blip = Cue | 'cue' | 'tick' | 'added';

/** A note: frequency (Hz), start and length (s) within the blip, waveform, and the pitch it slides to (a glide). */
type Note = [freq: number, at: number, len: number, wave?: OscillatorType, glideTo?: number];

const CUE: Note[] = [[880, 0, 0.04]];

const BLIPS: Record<Blip, Note[]> = {
  cue: CUE,
  /** The Desgraciat round stands everyone up: the cue blip, once. */
  standUp: CUE,
  tick: [[1400, 0, 0.012, 'square']],
  landing: [
    [520, 0, 0.05],
    [780, 0.04, 0.08],
  ],
  mark: [[300, 0, 0.06, 'triangle']],
  /** A card saved on «Afegir cartró» (`pad-saved`): two quiet rising notes, G5 then D6 (180 ms in all). */
  added: [
    [784, 0, 0.07],
    [1175, 0.07, 0.11],
  ],
  nearWin: [
    [660, 0, 0.08],
    [990, 0.09, 0.1],
  ],
  /** The Desgraciat's fall: a short descending two-note "bloop", each note sagging a little (180 ms in all). */
  fall: [
    [587, 0, 0.08, 'sine', 523],
    [392, 0.07, 0.11, 'sine', 330],
  ],
  celebrate: [
    [523, 0, 0.12],
    [659, 0.12, 0.12],
    [784, 0.24, 0.12],
    [1047, 0.36, 0.44],
  ],
};

type AudioContextCtor = new () => AudioContext;

export class Sounds implements TouchSounds {
  enabled = true;
  private ctx: AudioContext | null = null;
  private busyUntil = 0;
  private readonly Ctor: AudioContextCtor | null;
  private readonly laptop: boolean;
  private readonly touch: SpritePlayer;

  constructor() {
    const legacy = typeof window === 'undefined' ? undefined : (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    this.Ctor = typeof AudioContext !== 'undefined' ? AudioContext : (legacy ?? null);
    this.laptop = typeof location !== 'undefined' && isShowLaptop(location.hostname);
    this.touch = new SpritePlayer({
      url: spriteUrl,
      map: SPRITES.player,
      gate: () =>
        mayPlay({
          enabled: this.enabled,
          hidden: typeof document !== 'undefined' && document.hidden,
          showLaptop: this.laptop,
          ready: this.touch.ready,
          cueBusy: this.ctx !== null && this.ctx.currentTime < this.busyUntil,
        }),
    });
  }

  get supported(): boolean {
    return this.Ctor !== null;
  }

  /** Fetch the touch sounds' file once the page is idle (never on the show laptop, where nothing plays). */
  prefetch(): void {
    if (!this.laptop && this.Ctor) this.touch.prefetch();
  }

  /** Create or resume the audio context, and decode the touch sounds into it. Call from a user gesture (a tap). */
  unlock(): void {
    if (!this.Ctor || this.laptop) return;
    try {
      if (!this.ctx) {
        useAmbientAudioSession();
        this.ctx = new this.Ctor();
        void this.touch.attach(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** A touch sound (packages/ui/sounds/touch.ts calls this for the delegate and the components). */
  play(cls: TouchClass, variant: TouchVariant): void;
  /** A game cue. */
  play(blip: Blip): void;
  play(what: TouchClass | Blip, variant?: TouchVariant): void {
    if (variant) {
      this.touch.play(this.ctx, what as TouchClass, variant);
      return;
    }
    this.cue(what as Blip);
  }

  private cue(blip: Blip): void {
    const ctx = this.ctx;
    if (!this.enabled || this.laptop || !ctx || ctx.state !== 'running') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const now = ctx.currentTime;
    // One at a time: a tick may be dropped, anything else waits for nothing and is simply skipped.
    if (now < this.busyUntil) return;
    const notes = BLIPS[blip];
    let end = now;
    for (const [freq, at, len, wave = 'sine', glideTo] of notes) {
      const start = now + at;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + len);
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
