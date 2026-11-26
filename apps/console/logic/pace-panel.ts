// The Pace panel: the preset it recommends, and the notice while the engine bends the Pace to recover the
// Schedule. Pure: the engine's default Pace comes in (the snapshot's, else engine-rules.ts DEFAULT_PACE_SEC).
import type { PaceInfo } from '@quina/protocol';

/**
 * The preset recommended: the Pace the engine starts every round with (a repeat's slot, 14 s: a song's first play
 * gets 22/14 of it, D174), when it is one of the presets; else null.
 */
export function recommendedPreset(defaultPace: number, presets: readonly number[]): number | null {
  return presets.includes(defaultPace) ? defaultPace : null;
}

/** The Schedule recovery in words: songs get shorter to catch up (faster) or longer when ahead (slower). */
export interface RecoveryNotice {
  direction: 'faster' | 'slower';
  /** How much each song changes, in whole seconds; 0 when it is under half a second. */
  seconds: number;
}

/**
 * While the Drift nudge acts (`pace.nudge` ≠ 1: the engine stretches or squeezes each slot to recover the
 * Schedule), how much shorter or longer each song is than the Pace alone would make it. `slotSec` already has
 * the nudge applied, so the difference is slot − slot / nudge. Null with no nudge, or with the Pace locked.
 */
export function recoveryNotice(pace: PaceInfo): RecoveryNotice | null {
  const { nudge, slotSec, locked } = pace;
  if (locked || !Number.isFinite(nudge) || !Number.isFinite(slotSec) || nudge <= 0 || Math.abs(nudge - 1) < 0.005) return null;
  const change = slotSec - slotSec / nudge;
  return { direction: change < 0 ? 'faster' : 'slower', seconds: Math.round(Math.abs(change)) };
}
