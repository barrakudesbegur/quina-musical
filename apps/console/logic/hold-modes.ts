// Parlem and Aguanta, the two ways to stop new songs landing (GLOSSARY.md):
// - Parlem, the Hold: the music ducks under the presenters' voices;
// - Aguanta, the Stay: the song keeps playing at full volume.
// Pressing the active one again releases it; pressing the other one switches mode in place (`hold { duck }`
// while holding never releases). The active one shows pressed, from the engine's private `hold.ducked`.
// Pure.
import type { CommandFields, ShowState } from '@quina/protocol';

export type HoldMode = 'talk' | 'stay';

/** The `hold` command that enters a mode, or switches to it from the other one. */
const withDuck = (duck: boolean): CommandFields['hold'] => ({ on: true, duck });

/** The mode of the current Hold, or null when not holding. A Hold without `ducked` (an older engine) is Parlem. */
export function activeHoldMode(state: Pick<ShowState, 'status' | 'hold'> | null): HoldMode | null {
  if (!state || state.status !== 'hold' || !state.hold) return null;
  return state.hold.ducked === false ? 'stay' : 'talk';
}

/**
 * What pressing a mode's button sends: the active mode again releases (`on: false`); otherwise it enters that
 * mode, or switches to it from the other one.
 */
export function holdPress(mode: HoldMode, active: HoldMode | null): CommandFields['hold'] {
  if (active === mode) return { on: false };
  return withDuck(mode === 'talk');
}
