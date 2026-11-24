// The Pace panel: the preset it recommends, and the notice while the engine bends the Pace to recover the
// Schedule. Pure: the engine's default Pace comes in as a function (engine-rules.ts defaultPaceFor).
import type { PaceInfo } from '@quina/protocol';

/**
 * The preset recommended for a round: the Pace the engine starts that round with (last year's medians: about
 * 22 s in the first round, 14 s after), when it is one of the presets; else null. Before the first round
 * (round 0) it is the first round's.
 */
export function recommendedPreset(roundNumber: number, presets: readonly number[], defaultPaceFor: (round: number) => number): number | null {
  const pace = defaultPaceFor(Math.max(1, Math.floor(roundNumber)));
  return presets.includes(pace) ? pace : null;
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
