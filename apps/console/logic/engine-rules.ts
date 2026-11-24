// The engine's own rules that the console mirrors on screen, read from the engine's pure modules so they
// can't drift from what the engine does:
// - the Heat band of each Phase (game/phase.ts): the engine draws a round's Heat inside its Phase's band, so
//   the band starts are where each Phase starts on the header's Heat bar;
// - the default Pace of a round (plan/pace.ts): the engine sets it at each Shuffle, and the Pace panel
//   recommends it.
// Neither is in @quina/protocol or the state yet. Moving them there (a `heatBands` constant, and
// `pace.defaultSec` in the snapshot) is a proposal for the sound engine session; until then only this file
// imports engine code for them.
import { PHASE_MODEL_DEFAULTS } from '../../show/engine/src/game/phase.ts';
import { defaultPace } from '../../show/engine/src/plan/pace.ts';
import type { PhaseName } from '@quina/protocol';

/** Per Phase, the [low, high] range of the Heat the engine draws for it (0..1). */
export const HEAT_BANDS: Readonly<Record<PhaseName, readonly [number, number]>> = PHASE_MODEL_DEFAULTS.heatBands;

/** The Pace the engine starts a round with, in seconds (1-based round number). */
export const defaultPaceFor: (round: number) => number = defaultPace;
