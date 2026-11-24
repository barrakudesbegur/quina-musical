// Audible audio-clock time for visuals. getOutputTimestamp() tells us which context time is leaving the
// speakers at a given performance.now(); we smooth the offset between the two clocks (Chrome's values
// jitter) and subtract a calibrated display lag (projector) so the picture matches the sound.
const SMOOTHING = 0.08;
const RESET_JUMP_SEC = 0.05;
const STORAGE_KEY = 'mixer.displayOffsetMs';

export class AudioClock {
  ctx: AudioContext;
  offset: number | null;
  frozenAt: number | null;
  displayOffsetMs: number;
  extraLatencySec: number;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.offset = null; // performance seconds − context seconds
    this.frozenAt = null;
    this.displayOffsetMs = readStoredOffset();
    // Fixed processing delay inside our graph (Chrome's DynamicsCompressor pre-delay: 6 ms, measured
    // on test.html); visuals must wait for it like the sound does.
    this.extraLatencySec = 0;
  }

  setDisplayOffsetMs(ms: number): void {
    this.displayOffsetMs = ms;
    try {
      localStorage.setItem(STORAGE_KEY, String(ms));
    } catch {}
  }

  // Context time of the sample being heard right now (minus display lag). Freezes while suspended.
  audible(nowMs: number = performance.now()): number {
    const { ctx } = this;
    if (ctx.state !== 'running') {
      this.offset = null;
      return this.frozenAt ?? ctx.currentTime;
    }
    let raw: number | null = null;
    if (typeof ctx.getOutputTimestamp === 'function') {
      // Both fields are optional in the spec's dictionary; a missing one reads as "no timestamp yet".
      const ts = ctx.getOutputTimestamp();
      const performanceTime = ts?.performanceTime ?? 0;
      const contextTime = ts?.contextTime ?? 0;
      if (performanceTime > 0 && contextTime > 0) raw = performanceTime / 1000 - contextTime;
    }
    if (raw == null) raw = nowMs / 1000 - (ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0));
    if (this.offset == null || Math.abs(raw - this.offset) > RESET_JUMP_SEC) this.offset = raw;
    else this.offset += (raw - this.offset) * SMOOTHING;
    const t = nowMs / 1000 - this.offset - this.extraLatencySec - this.displayOffsetMs / 1000;
    this.frozenAt = t;
    return t;
  }

  // Epoch milliseconds at which context time t will be (or was) audible.
  ctxToEpochMs(t: number): number {
    const offset = this.offset ?? performance.now() / 1000 - this.ctx.currentTime;
    return performance.timeOrigin + (t + offset + this.extraLatencySec) * 1000;
  }

  epochMsToCtx(ms: number): number {
    const offset = this.offset ?? performance.now() / 1000 - this.ctx.currentTime;
    return (ms - performance.timeOrigin) / 1000 - offset - this.extraLatencySec;
  }

  latencyMs(): { outputLatencyMs: number; baseLatencyMs: number } {
    return {
      outputLatencyMs: Math.round((this.ctx.outputLatency || 0) * 1000),
      baseLatencyMs: Math.round((this.ctx.baseLatency || 0) * 1000),
    };
  }
}

function readStoredOffset(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}
