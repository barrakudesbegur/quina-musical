// Time helpers shared by the screens. Devices share epoch-ms timestamps, never an audio clock (ADR 0002),
// so a screen on another device corrects its own clock by an estimated offset before it computes a
// countdown. Pure apart from the `now` that callers pass in.

/**
 * Estimates the offset between this device's clock and the sender's. Feed it every message that carries
 * the sender's time (`state.atMs`, the public feed's `nowMs`) together with the local time it arrived.
 * One-way latency makes each sample read slightly behind. So it keeps the largest offset of recent samples,
 * which is the one with the least delay.
 */
export class ClockOffset {
  private samples: number[] = [];
  private readonly keep: number;

  constructor(keep = 8) {
    this.keep = keep;
  }

  /** `senderMs`: the sender's clock in the message; `localMs`: Date.now() when it arrived. */
  add(senderMs: number, localMs: number): void {
    if (!Number.isFinite(senderMs) || !Number.isFinite(localMs)) return;
    this.samples.push(senderMs - localMs);
    if (this.samples.length > this.keep) this.samples.shift();
  }

  /** Milliseconds to add to the local clock to read the sender's (0 before any sample). */
  get offsetMs(): number {
    return this.samples.length ? Math.max(...this.samples) : 0;
  }

  /** The sender's clock now, from a local `Date.now()`. */
  now(localMs: number): number {
    return localMs + this.offsetMs;
  }
}

/** Whole seconds left until `atMs` (never negative), or null. */
export function secondsLeft(atMs: number | null | undefined, nowMs: number): number | null {
  if (atMs === null || atMs === undefined) return null;
  return Math.max(0, Math.ceil((atMs - nowMs) / 1000));
}

/** "m:ss" for a countdown. */
export function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A local clock time split for display: "10:14" and "pm". 12-hour clock, as the user asked for every screen. */
export interface ClockParts {
  time: string;
  period: 'am' | 'pm';
}

/** The parts of a local clock time, or null without a time. Midnight is "12:00 am", noon "12:00 pm". */
export function clockParts(ms: number | null | undefined): ClockParts | null {
  if (!ms) return null;
  const d = new Date(ms);
  const h = d.getHours();
  return { time: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`, period: h < 12 ? 'am' : 'pm' };
}

/** "10:14 pm", 12-hour local clock time, or "—". */
export function formatClock(ms: number | null | undefined): string {
  const parts = clockParts(ms);
  return parts ? `${parts.time} ${parts.period}` : '—';
}

/** Drift for presenters: "a l'hora", "+3 min" (late) or "−2 min" (early). */
export function formatDrift(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || Math.abs(sec) < 30) return "a l'hora";
  const min = Math.round(Math.abs(sec) / 60);
  return `${sec > 0 ? '+' : '−'}${min} min`;
}

/** An end time rounded to 5 minutes (what phones may see). */
export function roundTo5Min(ms: number): number {
  const step = 5 * 60 * 1000;
  return Math.round(ms / step) * step;
}
