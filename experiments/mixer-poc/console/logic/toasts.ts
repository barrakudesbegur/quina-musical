// Toasts: command rejections (in Catalan, with the reason) and local notices such as "not sent". A console
// toasts only the rejections of its own commands, which it recognises by their reqId: every console sees
// every rejection, since the relay forwards the engine's events to all. Pure.
import type { CommandRejected } from '@quina/protocol';

export type ToastTone = 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
  /** A secondary line, for example the engine's `detail`. */
  detail: string | null;
  /** When it hides by itself (epoch ms). */
  untilMs: number;
}

/** Add a toast; keep at most `max`, dropping the oldest. */
export function pushToast(list: readonly Toast[], toast: Toast, max: number): Toast[] {
  const next = [...list, toast];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** The toasts still showing at `nowMs`. Returns the same array when nothing expired (no needless updates). */
export function liveToasts(list: readonly Toast[], nowMs: number): readonly Toast[] {
  return list.some((t) => t.untilMs <= nowMs) ? list.filter((t) => t.untilMs > nowMs) : list;
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
