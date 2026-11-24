// The cloud's own daily usage against the Workers Free plan's daily limits, counted by the GameRoom itself (no
// Cloudflare analytics token needed). Pure: the counters, the shares of each limit and the warning level.
// Limits (Workers Free plan, Durable Objects with SQLite): 100,000 requests a day, where 20 incoming WebSocket
// messages count as one request; 5,000,000 rows read and 100,000 rows written a day. They reset at 00:00 UTC
// (01:00 in Catalonia in winter). Outgoing messages (the broadcasts to phones) are free.

export const FREE_LIMITS = Object.freeze({ requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 });
/** Incoming WebSocket messages billed as one request. */
export const MESSAGES_PER_REQUEST = 20;
/** The preflight and Admin warn from this share of a limit, and fail from FAIL_SHARE. */
export const WARN_SHARE = 0.6;
export const FAIL_SHARE = 0.85;

export interface DailyUsage {
  /** The UTC day these counts are for, "2026-12-20". */
  day: string;
  /** Requests into the GameRoom: WebSocket upgrades, the Worker's calls, alarms. */
  requests: number;
  /** Incoming WebSocket messages (the laptop's uploads and events, the consoles' commands). */
  wsMessagesIn: number;
  rowsRead: number;
  rowsWritten: number;
  /** The most phones following the feed at once today. */
  phonesPeak: number;
}

export type UsageField = 'requests' | 'wsMessagesIn' | 'rowsRead' | 'rowsWritten';
export type UsageLevel = 'ok' | 'warn' | 'fail';

export interface UsageReport extends DailyUsage {
  /** Requests as billed: requests plus incoming messages / 20. */
  billedRequests: number;
  limits: typeof FREE_LIMITS;
  /** Each limit's share used, 0..1 (can pass 1). */
  shares: { requests: number; rowsRead: number; rowsWritten: number };
  level: UsageLevel;
  /** When the counts start again (the next 00:00 UTC), epoch ms. */
  resetAtMs: number;
}

export const utcDay = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 10);

export const emptyUsage = (nowMs: number): DailyUsage => ({ day: utcDay(nowMs), requests: 0, wsMessagesIn: 0, rowsRead: 0, rowsWritten: 0, phonesPeak: 0 });

/** The next 00:00 UTC after `nowMs`. */
export function nextResetMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function usageReport(u: DailyUsage, nowMs: number): UsageReport {
  const billedRequests = u.requests + Math.ceil(u.wsMessagesIn / MESSAGES_PER_REQUEST);
  const shares = { requests: billedRequests / FREE_LIMITS.requests, rowsRead: u.rowsRead / FREE_LIMITS.rowsRead, rowsWritten: u.rowsWritten / FREE_LIMITS.rowsWritten };
  const worst = Math.max(shares.requests, shares.rowsRead, shares.rowsWritten);
  const level: UsageLevel = worst >= FAIL_SHARE ? 'fail' : worst >= WARN_SHARE ? 'warn' : 'ok';
  return { ...u, billedRequests, limits: FREE_LIMITS, shares, level, resetAtMs: nextResetMs(nowMs) };
}

/**
 * The counters kept in memory and saved now and then: every `flushEvery` counts or `flushAfterMs`, so counting
 * costs few rows written. A new UTC day starts from zero (the old day is saved first).
 */
export class UsageCounter {
  private current: DailyUsage;
  private pending = 0;
  private savedAtMs: number;
  private readonly save: (u: DailyUsage) => void;
  private readonly flushEvery: number;
  private readonly flushAfterMs: number;

  constructor(loaded: DailyUsage | null, nowMs: number, save: (u: DailyUsage) => void, flushEvery = 200, flushAfterMs = 60_000) {
    this.current = loaded && loaded.day === utcDay(nowMs) ? { ...loaded } : emptyUsage(nowMs);
    this.savedAtMs = nowMs;
    this.save = save;
    this.flushEvery = flushEvery;
    this.flushAfterMs = flushAfterMs;
  }

  count(field: UsageField, n: number, nowMs: number): void {
    if (n <= 0) return;
    this.rollOver(nowMs);
    this.current[field] += n;
    this.pending += 1;
    if (this.pending >= this.flushEvery || nowMs - this.savedAtMs >= this.flushAfterMs) this.flush(nowMs);
  }

  phones(connected: number, nowMs: number): void {
    this.rollOver(nowMs);
    if (connected > this.current.phonesPeak) {
      this.current.phonesPeak = connected;
      this.pending += 1;
    }
  }

  flush(nowMs: number): void {
    this.rollOver(nowMs);
    if (this.pending === 0) return;
    this.pending = 0;
    this.savedAtMs = nowMs;
    this.save({ ...this.current });
  }

  read(nowMs: number): DailyUsage {
    this.rollOver(nowMs);
    return { ...this.current };
  }

  private rollOver(nowMs: number): void {
    const day = utcDay(nowMs);
    if (day === this.current.day) return;
    if (this.pending > 0) this.save({ ...this.current });
    this.current = emptyUsage(nowMs);
    this.pending = 0;
    this.savedAtMs = nowMs;
  }
}
