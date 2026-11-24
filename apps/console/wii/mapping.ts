// What each Wii Remote button does (the user's mapping, docs/show-ui-and-platform-decisions.md). Pure: button
// edges, accelerometer samples and clock ticks in; commands and rumbles out. The caller sends the commands
// exactly as the console's own buttons would.
//   A: Següent · B held: Aguanta, released: back to normal · B held + a deliberate shake: Suspens, and
//   releasing B lands it · − or + tapped: Parlem on/off (or leaves Pausa), held: Pausa · 1 or 2 held 1.5 s:
//   Enrere · HOME: auto-advance on/off
//   (different rumbles) · D-pad: four effects. Claims never come from the remote.
import type { CommandFields, SoundName } from '@quina/protocol';
import { holdPress, type HoldMode } from '../logic/hold-modes.ts';
import { magnitude, type Accel, type WiiButton } from './report.ts';
import { ShakeDetector, type ShakeConfig } from './shake.ts';

export type RumbleName = 'tap' | 'suspense' | 'pause' | 'back' | 'autoOn' | 'autoOff';
export type DpadButton = 'up' | 'right' | 'down' | 'left';

export type WiiCommand =
  | { cmd: 'next' }
  | { cmd: 'back' }
  | { cmd: 'hold'; args: CommandFields['hold'] }
  | { cmd: 'suspense'; args: CommandFields['suspense'] }
  | { cmd: 'pause'; args: CommandFields['pause'] }
  | { cmd: 'setGame'; args: { autoAdvance: boolean } }
  | { cmd: 'sfx'; args: { name: SoundName } };

export interface WiiOutput {
  command: WiiCommand | null;
  rumble: RumbleName;
}

export interface WiiMappingConfig {
  shake: ShakeConfig;
  backHoldMs: number;
  /** − or + held this long is Pausa; shorter is a Parlem tap. */
  pauseHoldMs: number;
  dpad: Readonly<Record<DpadButton, SoundName>>;
}

/** What the mapping needs to know about the show to toggle things. */
export interface WiiContext {
  holdMode: HoldMode | null;
  autoAdvance: boolean;
  /** In Pausa (the long break): a tap on − or + leaves it. */
  paused: boolean;
}

const out = (command: WiiCommand | null, rumble: RumbleName = 'tap'): WiiOutput[] => [{ command, rumble }];

export class WiiMapper {
  private readonly cfg: WiiMappingConfig;
  private readonly shake: ShakeDetector;
  private bHeld = false;
  private suspenseOn = false;
  private backSince: number | null = null;
  private backFired = false;
  private talkSince: number | null = null;
  private talkFired = false;

  constructor(cfg: WiiMappingConfig) {
    this.cfg = cfg;
    this.shake = new ShakeDetector(cfg.shake);
  }

  press(button: WiiButton, tMs: number, ctx: WiiContext): WiiOutput[] {
    switch (button) {
      case 'a':
        return out({ cmd: 'next' });
      case 'b':
        this.bHeld = true;
        this.suspenseOn = false;
        this.shake.reset();
        return out({ cmd: 'hold', args: { on: true, duck: false } });
      case 'minus':
      case 'plus':
        // Decided on release (a tap) or by the clock (held long enough: Pausa).
        if (this.talkSince === null) {
          this.talkSince = tMs;
          this.talkFired = false;
        }
        return [];
      case 'one':
      case 'two':
        if (this.backSince === null) {
          this.backSince = tMs;
          this.backFired = false;
        }
        return [];
      case 'home':
        return out({ cmd: 'setGame', args: { autoAdvance: !ctx.autoAdvance } }, ctx.autoAdvance ? 'autoOff' : 'autoOn');
      default:
        return out({ cmd: 'sfx', args: { name: this.cfg.dpad[button] } });
    }
  }

  release(button: WiiButton, ctx: WiiContext): WiiOutput[] {
    if (button === 'b' && this.bHeld) {
      this.bHeld = false;
      const landing = this.suspenseOn;
      this.suspenseOn = false;
      return out(landing ? { cmd: 'suspense', args: { on: false } } : { cmd: 'hold', args: { on: false } });
    }
    if (button === 'one' || button === 'two') this.backSince = null;
    if ((button === 'minus' || button === 'plus') && this.talkSince !== null) {
      const tapped = !this.talkFired;
      this.talkSince = null;
      if (tapped) return out(ctx.paused ? { cmd: 'pause', args: { on: false } } : { cmd: 'hold', args: holdPress('talk', ctx.holdMode) });
    }
    return [];
  }

  /** An accelerometer sample. Only a shake while B is held (and not yet in Suspens) does anything. */
  motion(tMs: number, accel: Accel): WiiOutput[] {
    if (!this.bHeld || this.suspenseOn) return [];
    if (!this.shake.push(tMs, magnitude(accel))) return [];
    this.suspenseOn = true;
    return out({ cmd: 'suspense', args: { on: true } }, 'suspense');
  }

  /** The clock: 1 or 2 held long enough is Enrere, − or + held long enough is Pausa (once per press). */
  tick(tMs: number): WiiOutput[] {
    const outs: WiiOutput[] = [];
    if (this.talkSince !== null && !this.talkFired && tMs - this.talkSince >= this.cfg.pauseHoldMs) {
      this.talkFired = true;
      outs.push(...out({ cmd: 'pause', args: { on: true } }, 'pause'));
    }
    if (this.backSince !== null && !this.backFired && tMs - this.backSince >= this.cfg.backHoldMs) {
      this.backFired = true;
      outs.push(...out({ cmd: 'back' }, 'back'));
    }
    return outs;
  }

  /** The remote went away: forget held buttons (the caller releases a hold it started if it wants). */
  reset(): void {
    this.bHeld = false;
    this.suspenseOn = false;
    this.backSince = null;
    this.talkSince = null;
    this.shake.reset();
  }
}
