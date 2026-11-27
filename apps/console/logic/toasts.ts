// Toasts: command rejections (in Catalan, with the reason) and local notices such as "not sent". A console
// toasts only the rejections of its own commands, which it recognises by their reqId: every console sees
// every rejection, since the relay forwards the engine's events to all. While a modal dialog is open the page
// under it is inert and hidden, so a toast waits ("held") and shows when the dialog closes (ANIMATIONS.md
// `toast-in`). Pure.
import type { CommandRejected } from '@quina/protocol';

export type ToastTone = 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
  /** A secondary line, for example the engine's `detail`. */
  detail: string | null;
  /** When it hides by itself (epoch ms); null while it waits for an open dialog to close. */
  untilMs: number | null;
}

/** Add a toast; keep at most `max`, dropping the oldest. */
export function pushToast(list: readonly Toast[], toast: Toast, max: number): Toast[] {
  const next = [...list, toast];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The toasts still showing at `nowMs`. Returns the same array when nothing expired (no needless updates). */
export function liveToasts(list: readonly Toast[], nowMs: number): readonly Toast[] {
  const expired = (t: Toast) => t.untilMs !== null && t.untilMs <= nowMs;
  return list.some(expired) ? list.filter((t) => !expired(t)) : list;
}

/** The toasts on screen: not the ones waiting for a dialog to close. */
export function shownToasts(list: readonly Toast[]): readonly Toast[] {
  return list.some((t) => t.untilMs === null) ? list.filter((t) => t.untilMs !== null) : list;
}

/** A dialog opened: every toast waits behind it, those already showing too (they'd expire unseen). */
export function holdToasts(list: readonly Toast[]): readonly Toast[] {
  return list.some((t) => t.untilMs !== null) ? list.map((t) => (t.untilMs === null ? t : { ...t, untilMs: null })) : list;
}

/** The dialog closed: the waiting toasts show, hiding by themselves at `untilMs`. Returns the same array when none waited. */
export function releaseToasts(list: readonly Toast[], untilMs: number): readonly Toast[] {
  return list.some((t) => t.untilMs === null) ? list.map((t) => (t.untilMs === null ? { ...t, untilMs } : t)) : list;
}

export function dismissToast(list: readonly Toast[], id: number): Toast[] {
  return list.filter((t) => t.id !== id);
}

/** The reqIds this console sent recently, bounded. */
export class SentLog {
  private readonly ids: string[] = [];
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  remember(reqId: string): void {
    this.ids.push(reqId);
    if (this.ids.length > this.size) this.ids.shift();
  }

  has(reqId: string | null): boolean {
    return reqId !== null && this.ids.includes(reqId);
  }
}

/**
 * Whether to toast a rejection here: it answers one of this console's commands. A rejection without a reqId
 * (a command the engine couldn't even read) is shown everywhere, since nobody can tell whose it was.
 */
export function isOwnRejection(rejection: CommandRejected, sent: SentLog): boolean {
  return rejection.reqId === null || sent.has(rejection.reqId);
}
