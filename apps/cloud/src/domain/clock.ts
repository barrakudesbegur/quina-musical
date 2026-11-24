// The laptop's clock against the cloud's. Every link message carries its `sentAtMs`; the cloud keeps the smallest
// (receivedAt − sentAt) seen on the connection. That is the clock offset plus the shortest one-way delay, so
// it errs by tens of ms at most, which is plenty for a phone's reel to follow the projector's Spin.

/** The new offset estimate (cloud − laptop, ms) after one more message. */
export function nextClockOffset(previous: number | null, receivedAtMs: number, sentAtMs: number): number {
  const sample = receivedAtMs - sentAtMs;
  return previous === null ? sample : Math.min(previous, sample);
}

/** Convert laptop-clock epoch ms to the cloud's clock (an unknown offset counts as 0). */
export function toCloudMs(laptopMs: number, offsetMs: number | null): number {
  return Math.round(laptopMs + (offsetMs ?? 0));
}
