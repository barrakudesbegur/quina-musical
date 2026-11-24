// What each Wii Remote button does (the user's mapping, docs/show-ui-and-platform-decisions.md). Pure: button
// edges, accelerometer samples and clock ticks in; commands and rumbles out. The caller sends the commands
// exactly as the console's own buttons would.
//   A: Següent · B held: Aguanta, released: back to normal · B held + a deliberate shake: Suspens, and
//   releasing B lands it · − or +: Parlem on/off · 1 or 2 held 1.5 s: Enrere · HOME: auto-advance on/off
//   (different rumbles) · D-pad: four effects. Claims never come from the remote.
import type { CommandFields, SoundName } from '@quina/protocol';
import { holdPress, type HoldMode } from '../logic/hold-modes.ts';
import { magnitude, type Accel, type WiiButton } from './report.ts';
import { ShakeDetector, type ShakeConfig } from './shake.ts';

export type RumbleName = 'tap' | 'suspense' | 'back' | 'autoOn' | 'autoOff';
export type DpadButton = 'up' | 'right' | 'down' | 'left';

export type WiiCommand =
  | { cmd: 'next' }
  | { cmd: 'back' }
  | { cmd: 'hold'; args: CommandFields['hold'] }
  | { cmd: 'suspense'; args: CommandFields['suspense'] }
  | { cmd: 'setGame'; args: { autoAdvance: boolean } }
  | { cmd: 'sfx'; args: { name: SoundName } };

export interface WiiOutput {
  command: WiiCommand | null;
  rumble: RumbleName;
}

export interface WiiMappingConfig {
  shake: ShakeConfig;
  backHoldMs: number;
  dpad: Readonly<Record<DpadButton, SoundName>>;
}

/** What the mapping needs to know about the show to toggle things. */
export interface WiiContext {
  holdMode: HoldMode | null;
  autoAdvance: boolean;
}

const out = (command: WiiCommand | null, rumble: RumbleName = 'tap'): WiiOutput[] => [{ command, rumble }];

export class WiiMapper {
  private readonly cfg: WiiMappingConfig;
  private readonly shake: ShakeDetector;
  private bHeld = false;
  private suspenseOn = false;
  private backSince: number | null = null;
  private backFired = false;

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
        return out({ cmd: 'hold', args: holdPress('talk', ctx.holdMode) });
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

  release(button: WiiButton): WiiOutput[] {
    if (button === 'b' && this.bHeld) {
      this.bHeld = false;
      const landing = this.suspenseOn;
      this.suspenseOn = false;
      return out(landing ? { cmd: 'suspense', args: { on: false } } : { cmd: 'hold', args: { on: false } });
    }
    if (button === 'one' || button === 'two') this.backSince = null;
    return [];
  }

  /** An accelerometer sample. Only a shake while B is held (and not yet in Suspens) does anything. */
  motion(tMs: number, accel: Accel): WiiOutput[] {
    if (!this.bHeld || this.suspenseOn) return [];
    if (!this.shake.push(tMs, magnitude(accel))) return [];
    this.suspenseOn = true;
    return out({ cmd: 'suspense', args: { on: true } }, 'suspense');
  }

  /** The clock: 1 or 2 held long enough is Enrere (once per press). */
  tick(tMs: number): WiiOutput[] {
    if (this.backSince === null || this.backFired || tMs - this.backSince < this.cfg.backHoldMs) return [];
    this.backFired = true;
    return out({ cmd: 'back' }, 'back');
  }

  /** The remote went away: forget held buttons (the caller releases a hold it started if it wants). */
  reset(): void {
    this.bHeld = false;
    this.suspenseOn = false;
    this.backSince = null;
    this.shake.reset();
  }
}
