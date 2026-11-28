// Parlem and Aguanta, the two ways to stop new songs landing (GLOSSARY.md):
// - Parlem, the Hold: the music ducks under the presenters' voices;
// - Aguanta, the Stay: the song keeps playing at full volume.
// Pressing the active one again releases it; pressing the other one switches mode in place (`hold { duck }`
// while holding never releases). The active one shows pressed, from the engine's private `hold.ducked`.
// Each button has a second level, reached by holding it (packages/ui/components/hold/two-level.ts): Parlem → Pausa (the Pause),
// Aguanta → Suspens. A tap while the second level is on leaves it.
// Pure.
import type { CommandFields, ShowState } from '@quina/protocol';
import type { TwoLevelAction } from '../../../packages/ui/components/hold/two-level.ts';

export type HoldMode = 'talk' | 'stay';

/** The `hold` command that enters a mode, or switches to it from the other one. */
const withDuck = (duck: boolean): CommandFields['hold'] => ({ on: true, duck });

/**
 * The mode of the current Hold, or null when not holding. A Hold without `ducked` (an older engine) is Parlem.
 * The show flow holds the round under its own music in a round's intro, the Interval, the end and a Celebration: no
 * Parlem or Aguanta is on there (whats-left 2.3), except a Celebration's own Parlem once the presenters turn it on (D117).
 */
export function activeHoldMode(state: Pick<ShowState, 'status' | 'hold'> & Partial<Pick<ShowState, 'scene' | 'celebration'>> | null): HoldMode | null {
  if (!state) return null;
  if (state.scene === 'celebration') return state.celebration?.parlem ? 'talk' : null;
  if (state.scene === 'roundStart' || state.scene === 'interval' || state.scene === 'after') return null;
  if (state.status !== 'hold' || !state.hold) return null;
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

/** What a mode button's second level is now. */
export interface SecondLevel {
  /** It is on: a Pausa (Parlem), an open Suspens (Aguanta). */
  on: boolean;
  /** Holding the button would enter it now (the scene allows it and it isn't on yet). */
  canEnter: boolean;
}

export interface SecondLevelInput {
  /** The technical pause is on (`flow.pause`): Pausa, Parlem's second level. */
  paused: boolean;
  /** A Suspens is open: Aguanta's second level. */
  suspenseOpen: boolean;
  canPause: boolean;
  canSuspense: boolean;
}

export function secondLevel(mode: HoldMode, input: SecondLevelInput): SecondLevel {
  return mode === 'talk' ? { on: input.paused, canEnter: !input.paused && input.canPause } : { on: input.suspenseOpen, canEnter: !input.suspenseOpen && input.canSuspense };
}

export type ModeCommand =
  | { cmd: 'hold'; args: CommandFields['hold'] }
  | { cmd: 'pause'; args: CommandFields['pause'] }
  | { cmd: 'suspense'; args: CommandFields['suspense'] };

/**
 * The command for an action on a mode button (null: none):
 * - Parlem: a tap toggles Parlem, or leaves Pausa when it's on; a hold enters Pausa; letting go of it does
 *   nothing more (Pausa stays until a tap, or the pause panel's button);
 * - Aguanta: a tap toggles Aguanta, or releases an open Suspens; a hold opens Suspens and letting go lands.
 */
export function modeCommand(mode: HoldMode, action: TwoLevelAction, active: HoldMode | null, level2: SecondLevel): ModeCommand | null {
  if (mode === 'talk') {
    if (action === 'escalate') return { cmd: 'pause', args: { on: true } };
    if (action === 'release') return null;
    return level2.on ? { cmd: 'pause', args: { on: false } } : { cmd: 'hold', args: holdPress('talk', active) };
  }
  if (action === 'escalate') return { cmd: 'suspense', args: { on: true } };
  if (action === 'release') return { cmd: 'suspense', args: { on: false } };
  return level2.on ? { cmd: 'suspense', args: { on: false } } : { cmd: 'hold', args: holdPress('stay', active) };
}
