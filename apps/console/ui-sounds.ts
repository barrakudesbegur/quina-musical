// The tablet's touch sounds (U182; ANIMATIONS.md › Console sounds): soft, crisp clicks for this device's own taps,
// from packages/ui/sounds/console.mp3, at the sprite's quiet gain. On by default, switched off in the menu (the
// model's `uiSounds`). Never while the page is hidden, and never on the show laptop (D207): a console opened there
// (the "Without the tablet" set-up) would send its clicks to the PA. Browsers start audio only after a user gesture,
// so the first tap or key unlocks it (that one may be silent). The engine's audio never plays here: no cues.
import { isShowLaptop, mayPlay } from '../../packages/ui/sounds/logic.ts';
import { SpritePlayer, useAmbientAudioSession } from '../../packages/ui/sounds/sprite-player.ts';
import { SPRITES } from '../../packages/ui/sounds/sprites.ts';
import type { TouchSounds } from '../../packages/ui/sounds/touch.ts';
import type { TouchClass, TouchVariant } from '../../packages/ui/sounds/types.ts';
import spriteUrl from '../../packages/ui/sounds/console.mp3?url';

type AudioContextCtor = new () => AudioContext;

export class ConsoleSounds implements TouchSounds {
  /** This page runs on the show laptop: silent, and the menu's switch says so. */
  readonly showLaptop: boolean;
  private ctx: AudioContext | null = null;
  private readonly Ctor: AudioContextCtor | null;
  private readonly sprite: SpritePlayer;

  constructor(enabled: () => boolean) {
    const legacy = (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    this.Ctor = typeof AudioContext !== 'undefined' ? AudioContext : (legacy ?? null);
    this.showLaptop = isShowLaptop(location.hostname);
    this.sprite = new SpritePlayer({
      url: spriteUrl,
      map: SPRITES.console,
      gate: () => mayPlay({ enabled: enabled(), hidden: document.hidden, showLaptop: this.showLaptop, ready: this.sprite.ready, cueBusy: false }),
    });
  }

  /** Fetch the file when the page is idle, and unlock the audio at the first tap or key. Returns the unwiring. */
  start(): () => void {
    if (this.showLaptop || !this.Ctor) return () => undefined;
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(() => this.sprite.prefetch(), { timeout: 4000 }) : null;
    if (idle === null) setTimeout(() => this.sprite.prefetch(), 1500);
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }

  private unlock(): void {
    if (!this.Ctor) return;
    try {
      if (!this.ctx) {
        useAmbientAudioSession();
        this.ctx = new this.Ctor();
        void this.sprite.attach(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(cls: TouchClass, variant: TouchVariant): void {
    this.sprite.play(this.ctx, cls, variant);
  }
}
