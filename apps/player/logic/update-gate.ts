// When the app may reload itself into a new version (D222). The new service worker takes over at once
// (apps/player/sw/player-sw.ts), but the page still runs the old code until it reloads, so it reloads by itself at
// the first quiet moment, with no button to press ("I don't want issues of users having an old version", the user).
// Never in the middle of something: no finger down, no drawer open, no number half typed on the pad, no text field
// in use, not during a Celebration or the your-song moment, and only after a few quiet seconds. While the phone is
// in the background (the screen off, another app) it reloads at once, unless a drawer or a typed number would be
// lost. Pure: apps/player/device/updates.ts feeds it what the page and the app are doing.

export interface ReloadMoment {
  /** The page is in the background. */
  hidden: boolean;
  /** Drawers open (Ajustos, the pad, Premis…): a reload would close them. */
  drawers: number;
  /** A number is being typed on "Afegir cartró"'s pad. */
  padTyping: boolean;
  /** A finger (or the mouse) is down. */
  pressing: boolean;
  /** A text field has the focus (a card's name). */
  editing: boolean;
  /** A Celebration or the your-song moment is on screen. */
  bigMoment: boolean;
  /** Since the last touch, key, typing or scroll. */
  sinceInputMs: number;
}

export type ReloadVerdict = 'now' | 'wait';

/** May the app reload into the new version now? `quietMs`: how long without input counts as quiet. */
export function reloadVerdict(moment: ReloadMoment, quietMs: number): ReloadVerdict {
  if (moment.padTyping || moment.editing || moment.pressing || moment.drawers > 0) return 'wait';
  if (moment.hidden) return 'now';
  if (moment.bigMoment) return 'wait';
  return moment.sinceInputMs >= quietMs ? 'now' : 'wait';
}

/**
 * A new worker took control of the page. The first one ever (the page opened before any worker, then the worker
 * claimed it) brings no new code: only a change of controller after that means a new version.
 */
export const isNewVersion = (hadController: boolean): boolean => hadController;

/** Ask the server for a new worker now? At most once per `minGapMs`, whatever asks (a focus, the timer). */
export const checkDue = (lastCheckMs: number | null, nowMs: number, minGapMs: number): boolean => lastCheckMs === null || nowMs - lastCheckMs >= minGapMs;
