// Parlem and Aguanta, the two ways to stop new songs landing (GLOSSARY.md):
// - Parlem, the Hold: the music ducks under the presenters' voices;
// - Aguanta, the Stay: the song keeps playing at full volume.
// Pressing the active one again releases it; pressing the other one switches mode. The active one shows
// pressed, from the engine's `hold.ducked`.
//
// PROTOCOL PENDING: the sound engine session agreed to extend the protocol to `hold { on?, duck? }` with
// `HoldInfo.ducked`, but `COMMANDS.hold` has no `duck` yet. Until it lands, Aguanta can't be sent (its button
// is disabled) and every Hold reads as Parlem. When it lands, the wiring is the one line in `withDuck` below.
// Pure.
import type { CommandFields, ShowState } from '@quina/protocol';

export type HoldMode = 'talk' | 'stay';

/**
 * PROTOCOL PENDING: the `hold` command that enters (or switches to) a mode, or null while the protocol can't
 * say it. Once `COMMANDS.hold` has `duck`, this becomes: `(duck) => ({ on: true, duck })`.
 */
const withDuck = (duck: boolean): CommandFields['hold'] | null => (duck ? { on: true } : null);

/** The mode of the current Hold, or null when not holding. A Hold without `ducked` (today's engine) is Parlem. */
export function activeHoldMode(state: Pick<ShowState, 'status' | 'hold'> | null): HoldMode | null {
  if (!state || state.status !== 'hold' || !state.hold) return null;
  const hold = state.hold;
  const ducked = 'ducked' in hold && typeof hold.ducked === 'boolean' ? hold.ducked : true;
  return ducked ? 'talk' : 'stay';
}

/**
 * What pressing a mode's button sends: the active mode again releases (`on: false`); otherwise it enters that
 * mode, or switches to it from the other one. Null when it can't be sent yet (Aguanta, see above).
 */
export function holdPress(mode: HoldMode, active: HoldMode | null): CommandFields['hold'] | null {
  if (active === mode) return { on: false };
  return withDuck(mode === 'talk');
}
