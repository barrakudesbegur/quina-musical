// What each Wii Remote button does (the user's mapping, docs/show-ui-and-platform-decisions.md; the
// Consola-Comandament board). Pure: button edges, accelerometer samples and clock ticks in; commands and rumbles out.
// The caller sends the commands exactly as the console's own buttons would.
//   A: the default action (logic/default-action.ts: Següent in play, a Check's next reveal or its cue…), resolved by
//   the caller at the moment of the press; in a Check, A held reveals in a row («Seguides», D107) until it's let go ·
//   B held: Aguanta, released: back to normal · B held, then A held: Suspens (D144, D147), entered like the manual
//   one: it starts at once and `suspenseWindow.pulses` vibrations follow over `windowMs`; letting go of A before the
//   last cancels it (`suspense {on:false, cancel:true}`, back to Aguanta); after it, it can't be undone, a gentler
//   vibration lasts while it's on, and letting go of B lands it · A, then B while A is still held (A's press sent
//   Següent): the Spin that A started becomes that same Suspens (D176, D177; the engine converts it), its window
//   counted from both down; letting go of either inside it cancels, and a B still held is then Aguanta; a press of A
//   and its release before B is a plain Aguanta, which cancels the Spin, as ever · with «Avanç manual» (auto-advance off) B alone
//   enters that same Suspens (D145): letting go of B inside the window cancels it · B held plus a deliberate shake
//   (3 jolts, each one vibrating): Suspens at once, when the shake is switched on (D148, the console's setting) ·
//   − or + tapped: Parlem on/off (or leaves Pausa), held: Pausa, or in a Check (before its cue) «Revisió manual»
//   (D128; under review it's Pausa again, D135) · 1 or 2 held 1.5 s: Enrere; in a Check, a shorter press takes the
//   last revealed mark off (D127, D134) · HOME: auto-advance on/off (different rumbles) · D-pad: four effects.
//   While B is held, A only ever enters Suspens: Next is refused during Aguanta and Suspens anyway (D133).
//   Claims are typed on the tablet; A sends the claim pad's «Comprovar» only as its default action.
import type { CommandFields, SoundName } from '@quina/protocol';
import { holdPress, type HoldMode } from '../logic/hold-modes.ts';
import { magnitude, type Accel, type WiiButton } from './report.ts';
import { ShakeDetector, type ShakeConfig } from './shake.ts';

export type RumbleName = 'tap' | 'pause' | 'back' | 'autoOn' | 'autoOff' | 'suspenseStep' | 'suspenseOn' | 'suspenseCancel' | 'jolt' | 'refused' | 'stop';
export type DpadButton = 'up' | 'right' | 'down' | 'left';

export type WiiCommand =
  /** "Go ahead": whatever the console's default action is when it's pressed (the caller resolves it). */
  | { cmd: 'default' }
  | { cmd: 'back' }
  | { cmd: 'checkBack'; args: CommandFields['checkBack'] }
  | { cmd: 'checkReview'; args: CommandFields['checkReview'] }
  | { cmd: 'checkAuto'; args: CommandFields['checkAuto'] }
  | { cmd: 'hold'; args: CommandFields['hold'] }
  | { cmd: 'suspense'; args: CommandFields['suspense'] }
  | { cmd: 'pause'; args: CommandFields['pause'] }
  | { cmd: 'setGame'; args: { autoAdvance: boolean } }
  | { cmd: 'sfx'; args: { name: SoundName } };

export interface WiiOutput {
  command: WiiCommand | null;
  /** Null: no vibration (the press that starts a Suspens: its window's vibrations follow). */
  rumble: RumbleName | null;
}

export interface WiiMappingConfig {
  shake: ShakeConfig;
  backHoldMs: number;
  /** − or + held this long is Pausa; shorter is a Parlem tap. */
  pauseHoldMs: number;
  /** A held this long in a Check reveals in a row. */
  aHoldMs: number;
  /** Entering Suspens: the window to cancel it in, and how many vibrations mark it (the last at its end). */
  suspenseWindow: { windowMs: number; pulses: number };
  dpad: Readonly<Record<DpadButton, SoundName>>;
}

/** What the mapping needs to know about the show to toggle things. */
export interface WiiContext {
  holdMode: HoldMode | null;
  autoAdvance: boolean;
  /** In Pausa (the long break): a tap on − or + leaves it. */
  paused: boolean;
  /** A Check on screen (logic/check.ts), else null. */
  check: WiiCheckContext | null;
  /** A Suspens can start now: the scene allows it and no Spin is running. */
  canSuspense: boolean;
  /** A Suspens can be asked for even with a Spin running (none open): one asked for during a Spin turns it into the
   * Suspens (D177). */
  canSuspenseInSpin: boolean;
  /** A's press sends Següent (the console's default action is Next, enabled): B after it, A still held, is Suspens. */
  nextIsDefault: boolean;
  /** A Suspens is open (the state's `suspense`). */
  suspenseOpen: boolean;
  /** The shake gesture is switched on (D148; the console's setting). */
  shake: boolean;
}

/** What the remote can do in the Check on screen. */
export interface WiiCheckContext {
  /** A short 1 or 2 takes this mark off (while revealing), else null. */
  back: CommandFields['checkBack'] | null;
  /** − or + held sends this Check to review (before its cue, not under review), else null (Pausa as usual). */
  review: CommandFields['checkReview'] | null;
  /** A held reveals in a row (before the cue, not under review, songs to reveal). */
  auto: boolean;
}

const out = (command: WiiCommand | null, rumble: RumbleName | null = 'tap'): WiiOutput[] => [{ command, rumble }];

/**
 * The Suspens the remote is in, if any:
 * - window: just started by `key` (A after B, B alone with manual advance, or `ab`: B after A, A still held); letting
 *   go of `key` (with `ab`, of either) cancels it until the last vibration, at `startMs` + windowMs;
 * - on: it can't be undone any more; letting go of B lands it. `seenOpen`: the state has shown it open (until then a
 *   closed state is only the snapshot lagging behind);
 * - over: it ended by itself (its auto-release, or the tablet) while B is still held: letting go of B sends nothing.
 */
type RemoteSuspense =
  | { phase: 'none' }
  | { phase: 'window'; key: 'a' | 'b' | 'ab'; startMs: number; pulses: number }
  | { phase: 'on'; seenOpen: boolean }
  | { phase: 'over' };

const NO_SUSPENSE: RemoteSuspense = { phase: 'none' };

export class WiiMapper {
  private readonly cfg: WiiMappingConfig;
  private readonly shake: ShakeDetector;
  private bHeld = false;
  /** What pressing B started: Aguanta (`hold`), a Suspens (manual advance), or a Suspens from A's Spin (`spin`). */
  private bStarted: 'stay' | 'suspense' | 'spin' | null = null;
  private suspense: RemoteSuspense = NO_SUSPENSE;
  /** A went down while B was held: it belongs to the Suspens, so its release is never the default action's. */
  private aWithB = false;
  private backSince: number | null = null;
  private backFired = false;
  private talkSince: number | null = null;
  private talkFired = false;
  private aSince: number | null = null;
  /** A was held long enough to reveal in a row: letting go stops it. */
  private aAuto = false;
  /** A is down on its own (not after B), and whether its press sent Següent. */
  private aHeld = false;
  private aNext = false;

  constructor(cfg: WiiMappingConfig) {
    this.cfg = cfg;
    this.shake = new ShakeDetector(cfg.shake);
  }

  press(button: WiiButton, tMs: number, ctx: WiiContext): WiiOutput[] {
    switch (button) {
      case 'a':
        if (this.bHeld) {
          this.aWithB = true;
          this.aSince = null;
          // B + A: Suspens from Aguanta, once per B press (a Suspens already on stays as it is).
          if (this.suspense.phase !== 'none' || !ctx.canSuspense) return [];
          return this.enterSuspense('a', tMs);
        }
        this.aSince = tMs;
        this.aAuto = false;
        this.aHeld = true;
        this.aNext = ctx.nextIsDefault;
        return out({ cmd: 'default' });
      case 'b':
        this.bHeld = true;
        this.suspense = NO_SUSPENSE;
        this.shake.reset();
        // A, then B with A still held: the Spin A just started becomes a Suspens (D176, D177), even if the snapshot
        // doesn't show it yet (the engine takes Next first). A's release now belongs to the Suspens.
        if (this.aHeld && this.aNext && ctx.canSuspenseInSpin) {
          this.bStarted = 'spin';
          this.aWithB = true;
          this.aSince = null;
          return this.enterSuspense('ab', tMs);
        }
        // «Avanç manual»: B alone is Suspens (D145); otherwise it's Aguanta.
        if (!ctx.autoAdvance && ctx.canSuspense) {
          this.bStarted = 'suspense';
          return this.enterSuspense('b', tMs);
        }
        this.bStarted = 'stay';
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
    if (button === 'b' && this.bHeld) return this.releaseB(ctx);
    if (button === 'a') {
      this.aHeld = false;
      this.aNext = false;
      if (this.aWithB) {
        this.aWithB = false;
        // Let go inside its window: the Suspens backs out, and the song is back in Aguanta (B still held).
        if (this.suspense.phase === 'window' && (this.suspense.key === 'a' || this.suspense.key === 'ab')) {
          const fromSpin = this.suspense.key === 'ab';
          this.suspense = NO_SUSPENSE;
          const cancel = out({ cmd: 'suspense', args: { on: false, cancel: true } }, 'suspenseCancel');
          if (!fromSpin) return cancel;
          // From A's Spin no Aguanta was on: B, still held, is Aguanta from now (and ends with B).
          this.bStarted = 'stay';
          return [...cancel, ...out({ cmd: 'hold', args: { on: true, duck: false } }, null)];
        }
        return [];
      }
      const auto = this.aAuto;
      this.aSince = null;
      this.aAuto = false;
      if (auto) return out({ cmd: 'checkAuto', args: { on: false } }, 'autoOff');
    }
    if ((button === 'one' || button === 'two') && this.backSince !== null) {
      // In a Check, a press shorter than Enrere's hold takes the last revealed mark off.
      const short = !this.backFired;
      this.backSince = null;
      if (short && ctx.check?.back) return out({ cmd: 'checkBack', args: ctx.check.back });
    }
    if ((button === 'minus' || button === 'plus') && this.talkSince !== null) {
      const tapped = !this.talkFired;
      this.talkSince = null;
      if (tapped) return out(ctx.paused ? { cmd: 'pause', args: { on: false } } : { cmd: 'hold', args: holdPress('talk', ctx.holdMode) });
    }
    return [];
  }

  /**
   * An accelerometer sample. Only a shake while B is held, the shake is on and no Suspens is under way does anything:
   * each jolt vibrates, and the last one opens Suspens at once (no window: the shake is the deliberate gesture).
   */
  motion(tMs: number, accel: Accel, ctx: WiiContext): WiiOutput[] {
    if (!this.bHeld || this.suspense.phase !== 'none' || !ctx.shake || !ctx.canSuspense) return [];
    const step = this.shake.push(tMs, magnitude(accel));
    if (step === 'none') return [];
    if (step === 'jolt') return out(null, 'jolt');
    this.suspense = { phase: 'on', seenOpen: false };
    return out({ cmd: 'suspense', args: { on: true } }, 'suspenseOn');
  }

  /**
   * The clock (once per press): 1 or 2 held long enough is Enrere; − or + held long enough is Pausa, or in a Check
   * «Revisió manual»; A held long enough in a Check reveals in a row. A Suspens being entered vibrates on its window's
   * beats, and becomes final at the last one; one that ended by itself stops the remote's gentle vibration.
   */
  tick(tMs: number, ctx: WiiContext): WiiOutput[] {
    const outs: WiiOutput[] = [...this.suspenseTick(tMs, ctx)];
    if (this.talkSince !== null && !this.talkFired && tMs - this.talkSince >= this.cfg.pauseHoldMs) {
      this.talkFired = true;
      const review = ctx.check?.review;
      outs.push(...out(review ? { cmd: 'checkReview', args: review } : { cmd: 'pause', args: { on: true } }, 'pause'));
    }
    if (this.aSince !== null && !this.aAuto && tMs - this.aSince >= this.cfg.aHoldMs) {
      // Once per press: a hold outside a Check (or after its cue) does nothing, even if a Check comes on meanwhile.
      this.aSince = null;
      if (ctx.check?.auto) {
        this.aAuto = true;
        outs.push(...out({ cmd: 'checkAuto', args: { on: true } }, 'autoOn'));
      }
    }
    if (this.backSince !== null && !this.backFired && tMs - this.backSince >= this.cfg.backHoldMs) {
      this.backFired = true;
      outs.push(...out({ cmd: 'back' }, 'back'));
    }
    return outs;
  }

  /**
   * The engine refused what a key's press sent (D234's lock, enforced: another console held that button first): forget
   * that press, so letting go of it sends nothing. B's covers its Aguanta and its Suspens (and A's part in B + A); − and
   * + share Parlem's. The caller refuses the rest of the press (WiiLockGate).
   */
  forget(button: WiiButton): void {
    if (button === 'b') {
      this.bHeld = false;
      this.bStarted = null;
      this.suspense = NO_SUSPENSE;
      this.aWithB = false;
      this.shake.reset();
    } else if (button === 'minus' || button === 'plus') {
      this.talkSince = null;
    } else if (button === 'a') {
      this.aSince = null;
      this.aAuto = false;
      this.aHeld = false;
      this.aNext = false;
    }
  }

  /** The key whose press a refused command belongs to: a Suspens or Aguanta is B's (B + A's too); Parlem's and Pausa's
   * from − or +, or the default action's from A, are the key that sent them (`sentBy`). */
  static ownerOf(command: WiiCommand, sentBy: WiiButton): WiiButton {
    if (command.cmd === 'suspense' || (command.cmd === 'hold' && command.args.on && command.args.duck === false)) return 'b';
    return sentBy;
  }

  /** The key behind a command `tick` sent: Pausa or «Revisió manual» from − or + held, «Seguides» from A, Enrere from 1
   * or 2, and a Suspens's from B. */
  static tickKey(command: WiiCommand): WiiButton {
    switch (command.cmd) {
      case 'pause':
      case 'checkReview':
      case 'hold':
        return 'minus';
      case 'checkAuto':
      case 'default':
        return 'a';
      case 'back':
      case 'checkBack':
        return 'one';
      default:
        return 'b';
    }
  }

  /** The remote went away: forget held buttons (the caller releases a hold it started if it wants). */
  reset(): void {
    this.bHeld = false;
    this.bStarted = null;
    this.suspense = NO_SUSPENSE;
    this.aWithB = false;
    this.backSince = null;
    this.talkSince = null;
    this.aSince = null;
    this.aAuto = false;
    this.aHeld = false;
    this.aNext = false;
    this.shake.reset();
  }

  /** Start a Suspens now, with its window to cancel it in. The press itself stays still: the window's beats follow. */
  private enterSuspense(key: 'a' | 'b' | 'ab', tMs: number): WiiOutput[] {
    this.suspense = { phase: 'window', key, startMs: tMs, pulses: 0 };
    return out({ cmd: 'suspense', args: { on: true } }, null);
  }

  private releaseB(ctx: WiiContext): WiiOutput[] {
    const started = this.bStarted;
    const s = this.suspense;
    this.bHeld = false;
    this.bStarted = null;
    this.suspense = NO_SUSPENSE;
    if (s.phase === 'on') return out({ cmd: 'suspense', args: { on: false } });
    if (s.phase === 'window') {
      const cancel = out({ cmd: 'suspense', args: { on: false, cancel: true } }, 'suspenseCancel');
      // B let go while A's window ran: the Suspens backs out to Aguanta, and Aguanta ends with B.
      return started === 'stay' ? [...cancel, ...out({ cmd: 'hold', args: { on: false } }, null)] : cancel;
    }
    // Aguanta ends with B. After a Suspens that ended by itself only an Aguanta still on is let go (one the engine
    // refused leaves it on; one that landed ended it). From A's Spin, an Aguanta is on only if the Spin landed in its
    // last instant: the engine puts the new song in Aguanta while B is held (D177).
    if (started === 'stay' && (s.phase === 'none' || ctx.holdMode === 'stay')) return out({ cmd: 'hold', args: { on: false } });
    if (started === 'spin' && ctx.holdMode === 'stay') return out({ cmd: 'hold', args: { on: false } });
    return [];
  }

  private suspenseTick(tMs: number, ctx: WiiContext): WiiOutput[] {
    const s = this.suspense;
    if (s.phase === 'on') {
      if (ctx.suspenseOpen) {
        if (!s.seenOpen) this.suspense = { phase: 'on', seenOpen: true };
        return [];
      }
      if (!s.seenOpen) return [];
      // Released by itself (or from the tablet) while B is still held: the gentle vibration stops.
      this.suspense = { phase: 'over' };
      return out(null, 'stop');
    }
    if (s.phase !== 'window') return [];
    const { windowMs, pulses } = this.cfg.suspenseWindow;
    const due = Math.min(pulses, Math.floor(((tMs - s.startMs) * pulses) / windowMs));
    if (due <= s.pulses) return [];
    if (due < pulses) {
      this.suspense = { ...s, pulses: due };
      return out(null, 'suspenseStep');
    }
    // The last beat: from now on it can't be undone. A Suspens the engine never opened (refused) is simply over.
    if (!ctx.suspenseOpen) {
      this.suspense = { phase: 'over' };
      return out(null, 'stop');
    }
    this.suspense = { phase: 'on', seenOpen: true };
    return out(null, 'suspenseOn');
  }
}
