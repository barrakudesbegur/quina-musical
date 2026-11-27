// The lock mirror of the two-level buttons (D234): while one console holds Parlem (→ Pausa) or Aguanta (→ Suspens), the
// other consoles show that button locked until it's let go. Each console tells the engine when it presses and lets go of
// one (`twoLevelHold { button, on }`), from the touch screen and from the Wii remote (B is Aguanta's, − and + Parlem's);
// the state's `twoLevelHeld` names the holder (the relay's `from`, a clientId). Only a mirror: `hold`, `pause` and
// `suspense` still do the work, and the engine refuses another console's press `busy`, which the lock explains (no
// toast). Pure.
import type { ShowState, TwoLevelButton } from '@quina/protocol';
import type { WiiButton } from '../wii/report.ts';
import { labelForId } from '../../../packages/ui/client/endpoints.ts';
import type { HoldMode } from './hold-modes.ts';

/** Each mode's two-level button: Parlem's `hold`, Aguanta's `stay`. */
export const LOCK_BUTTON: Readonly<Record<HoldMode, TwoLevelButton>> = Object.freeze({ talk: 'hold', stay: 'stay' });

/** The button a Wii key holds: B is Aguanta's, − and + Parlem's; the others none. */
export function wiiLockButton(button: WiiButton): TwoLevelButton | null {
  if (button === 'b') return 'stay';
  if (button === 'minus' || button === 'plus') return 'hold';
  return null;
}

/** Where a press comes from on this console: the touch screen, or one of the Wii's keys. */
export type LockSource = 'touch' | `wii-${WiiButton}`;

/** This console's own presses, as the lock needs them. */
export interface OwnPresses {
  /** The buttons a finger (or a Wii key) is on now. */
  holding: ReadonlySet<TwoLevelButton>;
  /** When each button was last let go here (the show's clock, ms). */
  releasedAtMs: Readonly<Partial<Record<TwoLevelButton, number>>>;
}

export const NO_PRESSES: OwnPresses = Object.freeze({ holding: new Set<TwoLevelButton>(), releasedAtMs: Object.freeze({}) });

export interface LockRules {
  /** A press elsewhere shows as a lock only once it has lasted this long (a tap never flashes it). */
  afterMs: number;
  /** After this console lets go of a button, a lock of it that started before stays its own this long: the engine's
   * release is on its way (through the cloud, where every console shares the link's clientId, it can't be told apart
   * otherwise). */
  echoMs: number;
}

/**
 * Who holds `button` on another console, by its `label`, or null when it isn't locked here: not held, held by this
 * console (its clientId; or, through the cloud, this console is pressing it or just let go of it), or held only for a
 * moment so far.
 */
export function lockedBy(
  held: ShowState['twoLevelHeld'],
  button: TwoLevelButton,
  own: { clientId: string; presses: OwnPresses },
  nowMs: number,
  rules: LockRules,
): string | null {
  if (!held || held.button !== button || held.clientId === own.clientId) return null;
  if (own.presses.holding.has(button)) return null;
  const released = own.presses.releasedAtMs[button];
  if (released !== undefined && held.sinceMs <= released && nowMs - released < rules.echoMs) return null;
  if (nowMs - held.sinceMs < rules.afterMs) return null;
  return held.label;
}

/** Names the engine gives a console with no label of its own (the Bus's role default, the show page's own, a reqId's
 * bare prefix): those read as «una altra consola». */
const UNNAMED = new Set(['tablet', 'admin', 'cloud', 'show', 'drum', 'local', 'r', 'device']);

/**
 * The holder's name for the screen, from its label (the clientId: the device label made id-safe, then a dash and a
 * random part, "Mobil_admin-3f2a"): the device label, with its accents back when it's one of `presets` ("Mòbil
 * admin"); null when the console has no label of its own.
 */
export function holderName(label: string, presets: readonly string[]): string | null {
  const head = label.split('-')[0] ?? '';
  if (!head || UNNAMED.has(head)) return null;
  return presets.find((preset) => labelForId(preset) === head) ?? head.replace(/_/g, ' ');
}

/**
 * This console's presses of the two-level buttons from every source (the touch screen, the Wii's keys): the engine
 * hears `on: true` at a button's first press and `on: false` when the last source lets go, so the touch screen and the
 * remote held at once (or − and + together) are one hold.
 */
export class LockPresses {
  #sources = new Map<TwoLevelButton, Set<LockSource>>();
  #releasedAtMs: Partial<Record<TwoLevelButton, number>> = {};

  /** A source pressed `button`: the command to send, if this is its first. */
  press(button: TwoLevelButton, source: LockSource): { button: TwoLevelButton; on: true } | null {
    const sources = this.#sources.get(button) ?? new Set<LockSource>();
    const first = sources.size === 0;
    sources.add(source);
    this.#sources.set(button, sources);
    return first ? { button, on: true } : null;
  }

  /** A source let go of `button` at `atMs` (the show's clock): the command to send, if it was the last. */
  release(button: TwoLevelButton, source: LockSource, atMs: number): { button: TwoLevelButton; on: false } | null {
    const sources = this.#sources.get(button);
    if (!sources?.delete(source) || sources.size > 0) return null;
    this.#sources.delete(button);
    this.#releasedAtMs = { ...this.#releasedAtMs, [button]: atMs };
    return { button, on: false };
  }

  /** Every press `source` still holds, let go (the remote went away): the commands to send. */
  releaseAll(source: LockSource, atMs: number): { button: TwoLevelButton; on: false }[] {
    return [...this.#sources.keys()].flatMap((button) => this.release(button, source, atMs) ?? []);
  }

  /** The presses now, for `lockedBy`. */
  get presses(): OwnPresses {
    return { holding: new Set(this.#sources.keys()), releasedAtMs: this.#releasedAtMs };
  }
}
