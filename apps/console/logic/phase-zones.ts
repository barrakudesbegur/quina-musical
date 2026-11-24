// The header's Heat bar with its Phase zones. The Heat and the Phase share one scale: the engine draws the
// Heat inside its Phase's band (engine-rules.ts HEAT_BANDS: early 0.05–0.3, mid 0.3–0.55, late 0.55–0.8,
// final 0.8–1), so each band's start is where that Phase starts on the bar. Two caveats keep the label
// honest: the Heat is jittered and smoothed, so it can cross a mark by a few points, and a presenter's Phase
// override leaves the Heat on the cards' plan. So the label under the bar always names the engine's Phase,
// never one read off the bar. Pure.
import { PHASE_NAMES, type PhaseName } from '@quina/protocol';

export interface PhaseZone {
  phase: PhaseName;
  /** Where it starts and ends on the bar, 0..1. */
  start: number;
  end: number;
}

/**
 * The zones from per-Phase Heat bands, in Phase order: the first starts at 0 and the last ends at 1, and
 * each other one starts where its band does. Null when the bands don't climb with the Phase (out of order,
 * overlapping, or outside 0..1): then no mark would be true, and the bar shows only the Phase's name.
 */
export function phaseZones(bands: Readonly<Record<PhaseName, readonly [number, number]>>): PhaseZone[] | null {
  const starts: number[] = [];
  for (let i = 0; i < PHASE_NAMES.length; i++) {
    const [lo, hi] = bands[PHASE_NAMES[i]];
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi > 1 || lo > hi) return null;
    if (i > 0) {
      const [prevLo, prevHi] = bands[PHASE_NAMES[i - 1]];
      // A band must start above the previous one's start and not before its end (they may touch).
      if (lo <= prevLo || lo < prevHi - 1e-9 || lo >= 1) return null;
    }
    starts.push(i === 0 ? 0 : lo);
  }
  return PHASE_NAMES.map((phase, i) => ({ phase, start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : 1 }));
}

/** The marks between zones (every zone's start but the first), as 0..1 positions. */
export const zoneMarks = (zones: readonly PhaseZone[]): number[] => zones.slice(1).map((z) => z.start);

/** The zones' relative widths, for a CSS grid under the bar ("30fr 25fr 25fr 20fr"). */
export const zoneColumns = (zones: readonly PhaseZone[]): string => zones.map((z) => `${Math.round((z.end - z.start) * 1000) / 10}fr`).join(' ');
