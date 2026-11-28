// A stopped audio clock (D284): Chrome once kept an AudioContext "running" while its currentTime moved 0.005 s in
// 2 s. The engine's clock is the audio clock, so a Shuffle never ended and no Spin started, with nothing on screen to
// say why. The runtime feeds this detector a sample a second (wall time, the context's time, whether it's running);
// it says since when the clock has been stalled. Pure: no browser, so tests feed it numbers.

export interface StallThresholds {
  /** How long the clock must be slow before it counts as stalled, and good before it counts as back. */
  readonly windowMs: number;
  /** Slow: the clock advanced less than this share of the wall time. */
  readonly stallRatio: number;
  /** Back: the clock advanced at least this share of the wall time. */
  readonly recoverRatio: number;
}

export class AudioStallDetector {
  private prev: { wallMs: number; audioSec: number } | null = null;
  private slowSince: number | null = null;
  private goodSince: number | null = null;
  private since: number | null = null;
  /** The share of wall time the clock advanced between the last two samples (null before two running samples). */
  lastRatio: number | null = null;

  private readonly thresholds: StallThresholds;

  constructor(thresholds: StallThresholds) {
    this.thresholds = thresholds;
  }

  /** The stall's start (wall ms, as the samples'), or null when the clock is fine. */
  get stalledSince(): number | null {
    return this.since;
  }

  /**
   * One sample: `wallMs` from a monotonic wall clock (performance.now()), `audioSec` the context's currentTime,
   * `running` its state is 'running'. A context that isn't running (suspended on purpose: before the start button)
   * is never stalled, and its samples start over. Returns `stalledSince`.
   */
  sample(wallMs: number, audioSec: number, running: boolean): number | null {
    if (!running) {
      this.prev = null;
      this.slowSince = this.goodSince = this.since = this.lastRatio = null;
      return null;
    }
    const prev = this.prev;
    if (prev && wallMs <= prev.wallMs) return this.since;
    this.prev = { wallMs, audioSec };
    if (!prev) return this.since;
    const ratio = ((audioSec - prev.audioSec) * 1000) / (wallMs - prev.wallMs);
    this.lastRatio = ratio;
    const { windowMs, stallRatio, recoverRatio } = this.thresholds;
    if (this.since == null) {
      // Slow for the whole window, without one good interval in between: a hiccup shorter than it never counts.
      this.slowSince = ratio < stallRatio ? (this.slowSince ?? prev.wallMs) : null;
      if (this.slowSince != null && wallMs - this.slowSince >= windowMs) {
        this.since = this.slowSince;
        this.slowSince = this.goodSince = null;
      }
    } else {
      this.goodSince = ratio >= recoverRatio ? (this.goodSince ?? prev.wallMs) : null;
      if (this.goodSince != null && wallMs - this.goodSince >= windowMs) this.since = this.slowSince = this.goodSince = null;
    }
    return this.since;
  }
}
