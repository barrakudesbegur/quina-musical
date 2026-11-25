// The Wii remote's range (docs/operations.md › Fallbacks): in 2025 it was at the limit from the stage, and the preflight
// can't measure it. So the console that hosts the remote counts its drops, the times it disconnected without anyone
// asking, over a rolling window, and publishes them in `remote.status { drops, lastDropMs }` for every console and the
// preflight ("3 caigudes en 10 min"). A presenter's own "Desconnectar" isn't a drop. Pure: times come in, on the show's
// clock.

/** The drops still inside the window ending at `nowMs`, oldest first. */
export function recentDrops(times: readonly number[], nowMs: number, windowMs: number): number[] {
  return times.filter((t) => t > nowMs - windowMs && t <= nowMs);
}

/** What the host publishes: the drops in the window, and the latest one (null when none ever happened). */
export function dropReport(times: readonly number[], nowMs: number, windowMs: number): { drops: number; lastDropMs: number | null } {
  return { drops: recentDrops(times, nowMs, windowMs).length, lastDropMs: times.length ? Math.max(...times) : null };
}
