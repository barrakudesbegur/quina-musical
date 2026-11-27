// The lock mirror of the two-level buttons (D234): while one console holds Parlem (→ Pausa) or Aguanta (→ Suspens), the
// other consoles show that button locked until it's let go. Each console tells the engine when it presses and lets go of
// one (`twoLevelHold { button, on }`), from the touch screen and from the Wii remote (B is Aguanta's, − and + Parlem's);
// the state's `twoLevelHeld` names the holder (the relay's `from`, a clientId). Only a mirror: `hold`, `pause` and
// `suspense` still do the work, and the engine refuses another console's press `busy`, which the lock explains (no
// toast). The lock covers the remote too (WiiLockGate): a key whose button another console holds is refused whole, with
// a short "no" rumble, since the remote has no screen. Pure.
import { CLOUD_FROM_PREFIX, isCloudConsoleId, type CommandRejected, type RelayClients, type ShowState, type TwoLevelButton } from '@quina/protocol';
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
  /** The buttons a finger (or a Wii key) is on now, and when that press started (the show's clock, ms). */
  holding: ReadonlyMap<TwoLevelButton, number>;
  /** When each button was last let go here (the show's clock, ms). */
  releasedAtMs: Readonly<Partial<Record<TwoLevelButton, number>>>;
}

export const NO_PRESSES: OwnPresses = Object.freeze({ holding: new Map<TwoLevelButton, number>(), releasedAtMs: Object.freeze({}) });

export interface LockRules {
  /** A press elsewhere shows as a lock only once it has lasted this long (a tap never flashes it). */
  afterMs: number;
  /** A hold that started this long before this console's own press of the button is another console's, which this
   * press can't take (the engine refused it `busy`): the lock shows, and the press is dropped. A later or nearer one is
   * this press's own echo (through the cloud the clientIds can't tell them apart; the clocks differ by a little). */
  raceMs: number;
  /** After this console lets go of a button, a lock of it that started before stays its own this long: the engine's
   * release is on its way (through the cloud, where every console shares the link's clientId, it can't be told apart
   * otherwise). */
  echoMs: number;
}

/**
 * Whether a holder's id is this console's: its own clientId (on the LAN, the relay's stamp), or `cloud:` and it (through
 * the cloud, once it stamps each console as its own sender; ed631847).
 */
export function isOwnId(holder: string, clientId: string): boolean {
  return holder === clientId || holder === CLOUD_FROM_PREFIX + clientId;
}

/** This console, as the lock's own-vs-other rule needs it. */
export interface Own {
  clientId: string;
  presses: OwnPresses;
  /** The ids of the consoles the relay lists one by one (`relay.clients`: a LAN console's role, or a cloud console's
   * `console`). A holder among them, or with a `cloud:` id, is surely another console; any other is the cloud link's
   * shared id (before the cloud stamps each console), which only the timing tells apart. */
  consoles?: ReadonlySet<string>;
}

/** The ids `relay.clients` names one console each: the LAN's consoles (`tablet`, `admin`) and the cloud's (`console`). */
export function consoleIds(clients: RelayClients['clients']): Set<string> {
  return new Set(clients.filter((c) => c.role === 'tablet' || c.role === 'admin' || c.role === 'console').map((c) => c.clientId));
}

/**
 * Who holds `button` on another console, by its `label`, or null: not held, or held by this console. That is its id
 * (`isOwnId`); and, only for the cloud link's shared id, the timing: this console is pressing the button, from about
 * when the hold started, or just let go of it. The rule both the screen's lock and the remote's use.
 */
export function heldByOther(
  held: ShowState['twoLevelHeld'],
  button: TwoLevelButton,
  own: Own,
  nowMs: number,
  rules: Pick<LockRules, 'raceMs' | 'echoMs'>,
): string | null {
  if (!held || held.button !== button) return null;
  if (isOwnId(held.clientId, own.clientId)) return null;
  // A console of its own (a `cloud:` id, or one the relay lists): surely another, whatever the timing.
  if (isCloudConsoleId(held.clientId) || own.consoles?.has(held.clientId)) return held.label;
  const pressedAt = own.presses.holding.get(button);
  if (pressedAt !== undefined && held.sinceMs >= pressedAt - rules.raceMs) return null;
  const released = own.presses.releasedAtMs[button];
  if (released !== undefined && held.sinceMs <= released && nowMs - released < rules.echoMs) return null;
  return held.label;
}

/**
 * Who holds `button` on another console, while it shows locked on this screen; else null: `heldByOther`, once that
 * hold has lasted `afterMs` (so a tap elsewhere never flashes the padlock).
 */
export function lockedBy(
  held: ShowState['twoLevelHeld'],
  button: TwoLevelButton,
  own: Own,
  nowMs: number,
  rules: LockRules,
): string | null {
  const by = heldByOther(held, button, own, nowMs, rules);
  return by !== null && held && nowMs - held.sinceMs >= rules.afterMs ? by : null;
}

/** The commands D234's lock covers: the engine refuses them from any console but the holder's. */
const LOCKED_COMMANDS: ReadonlySet<string> = new Set(['hold', 'pause', 'suspense', 'twoLevelHold']);

/**
 * A refusal the lock explains: `hold`, `pause`, `suspense` (or the mirror's own `twoLevelHold`) refused `busy`, «held by
 * <clientId>», because another console holds a two-level button (the engine enforces D234: of two presses within the
 * network latency, the first wins). No toast: the lock says so on the screen, and the remote rumbles its «no».
 */
export function isLockRefusal(rejection: Pick<CommandRejected, 'cmd' | 'reason' | 'detail'>): boolean {
  return rejection.reason === 'busy' && LOCKED_COMMANDS.has(rejection.cmd ?? '') && (rejection.detail ?? '').startsWith('held by ');
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
  // Through the cloud a console's id is `cloud:` and its own («cloud:Tauleta-3f2a»).
  const id = label.startsWith(CLOUD_FROM_PREFIX) ? label.slice(CLOUD_FROM_PREFIX.length) : label;
  const head = id.split('-')[0] ?? '';
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
  #pressedAtMs = new Map<TwoLevelButton, number>();
  #releasedAtMs: Partial<Record<TwoLevelButton, number>> = {};
  /** Presses the engine refused (`busy`: another console holds the button): not ours, though a finger is still on. */
  #lost = new Set<TwoLevelButton>();

  /** A source pressed `button` at `atMs` (the show's clock): the command to send, if this is its first. */
  press(button: TwoLevelButton, source: LockSource, atMs: number): { button: TwoLevelButton; on: true } | null {
    const sources = this.#sources.get(button) ?? new Set<LockSource>();
    const first = sources.size === 0;
    sources.add(source);
    this.#sources.set(button, sources);
    if (first) {
      this.#pressedAtMs.set(button, atMs);
      this.#lost.delete(button);
    }
    return first ? { button, on: true } : null;
  }

  /**
   * The engine refused this console's press of `button` (`twoLevelHold` busy): another console holds it, so it isn't
   * this press's echo. The press stays until it's let go, but `presses` no longer claims the hold, so the lock shows
   * here at once (and a touch press under it drops); its let-go leaves no echo either.
   */
  lose(button: TwoLevelButton): void {
    if (!this.#sources.has(button)) return;
    this.#pressedAtMs.delete(button);
    this.#lost.add(button);
  }

  /** A source let go of `button` at `atMs` (the show's clock): the command to send, if it was the last. */
  release(button: TwoLevelButton, source: LockSource, atMs: number): { button: TwoLevelButton; on: false } | null {
    const sources = this.#sources.get(button);
    if (!sources?.delete(source) || sources.size > 0) return null;
    this.#sources.delete(button);
    this.#pressedAtMs.delete(button);
    if (!this.#lost.delete(button)) this.#releasedAtMs = { ...this.#releasedAtMs, [button]: atMs };
    return { button, on: false };
  }

  /** Every press `source` still holds, let go (the remote went away): the commands to send. */
  releaseAll(source: LockSource, atMs: number): { button: TwoLevelButton; on: false }[] {
    return [...this.#sources.keys()].flatMap((button) => this.release(button, source, atMs) ?? []);
  }

  /** The presses now, for `lockedBy`. */
  get presses(): OwnPresses {
    return { holding: new Map(this.#pressedAtMs), releasedAtMs: this.#releasedAtMs };
  }
}

/**
 * The remote under the lock (D234): a key whose two-level button another console holds is refused at its press, whole:
 * nothing is sent (no command, no `twoLevelHold`), the remote gives its "no" rumble (ANIMATIONS.md › wii-refused), and
 * the key's release does nothing either. A while such a B is down is refused too: B + A is Aguanta's second level
 * (Suspens). Decided at the press with `heldByOther`, the screen lock's own-vs-other rule, without its wait: the remote
 * has no padlock to flash. A lock that ends while the key is still down doesn't start it: press again.
 */
export class WiiLockGate {
  #refused = new Set<WiiButton>();

  /** A key went down: whether it's refused. `heldElsewhere`: whether another console holds that button now. */
  press(key: WiiButton, heldElsewhere: (button: TwoLevelButton) => boolean): boolean {
    const button = wiiLockButton(key);
    const refused = button ? heldElsewhere(button) : key === 'a' && this.#refused.has('b');
    if (refused) this.#refused.add(key);
    return refused;
  }

  /** The engine refused what `key`'s press sent (the lock, in a race): the rest of that press is refused too. */
  refuse(key: WiiButton): void {
    this.#refused.add(key);
  }

  /** A key went up: whether its press was refused (so its release does nothing). */
  release(key: WiiButton): boolean {
    return this.#refused.delete(key);
  }

  /** The remote went away. */
  reset(): void {
    this.#refused.clear();
  }
}
