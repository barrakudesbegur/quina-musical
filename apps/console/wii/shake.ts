// The deliberate shake: N strong jolts within a short window. Pure. A jolt counts when the acceleration's
// magnitude rises above `peakG`, and the next can only count once it has dropped back under `resetG` and
// `minGapMs` has passed, so one big swing is one jolt. Dancing rarely reaches the threshold three times in
// a row inside the window; the mapping also only listens while B is held.

export interface ShakeConfig {
  peakG: number;
  resetG: number;
  minGapMs: number;
  count: number;
  windowMs: number;
}

export class ShakeDetector {
  private readonly cfg: ShakeConfig;
  private jolts: number[] = [];
  private armed = true;

  constructor(cfg: ShakeConfig) {
    this.cfg = cfg;
  }

  /** Forget everything (B pressed again, a shake already used). */
  reset(): void {
    this.jolts = [];
    this.armed = true;
  }

  /** One sample: |a| in g at `tMs`. True when this sample completes the shake (then it starts over). */
  push(tMs: number, g: number): boolean {
    const { peakG, resetG, minGapMs, count, windowMs } = this.cfg;
    if (!this.armed) {
      if (g < resetG) this.armed = true;
      return false;
    }
    if (g < peakG) return false;
    const last = this.jolts[this.jolts.length - 1];
    if (last !== undefined && tMs - last < minGapMs) return false;
    this.armed = false;
    this.jolts = [...this.jolts.filter((t) => tMs - t <= windowMs), tMs];
    if (this.jolts.length >= count) {
      this.jolts = [];
      return true;
    }
    return false;
  }
}
