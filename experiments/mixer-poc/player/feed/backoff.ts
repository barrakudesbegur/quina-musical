// Reconnection timing for the phones, on top of the feed contract's `reconnectDelayMs` (full jitter: a random
// wait between 0 and a ceiling that doubles from 1 s to 30 s), so 400 phones never come back together.
// Pure apart from the random source, which is passed in.
import { PUBLIC_FEED, reconnectDelayMs } from './public.ts';

/** Counts failed attempts. Reset it once a connection has proved itself (a snapshot arrived). */
export class Backoff {
  attempt = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** The wait before the next try; each call counts one more failure. */
  next(): number {
    const delay = reconnectDelayMs(this.attempt, this.random);
    this.attempt++;
    return delay;
  }

  reset(): void {
    this.attempt = 0;
  }
}

/** The wait before reconnecting when the page comes back to the foreground: 0–2 s, so a room spreads out. */
export function resumeDelayMs(random: () => number = Math.random): number {
  return Math.floor(Math.min(0.999999, Math.max(0, random())) * PUBLIC_FEED.resumeJitterMs);
}
