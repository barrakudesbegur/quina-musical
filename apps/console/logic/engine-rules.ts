// The engine's rules the console mirrors on screen, from @quina/protocol (the engine uses the same constants):
// - the Heat band of each Phase: the engine draws a round's Heat inside its Phase's band, so the band starts
//   are where each Phase starts on the header's Heat bar;
// - the default Pace: the engine starts every round with it (and reports it as `pace.defaultSec`), and the Pace
//   panel recommends it. The Pace is a repeat's slot; a song's first play in the Game gets 22/14 of it (D174).
import { HEAT_BANDS as PROTOCOL_HEAT_BANDS, PACE_DEFAULT_SEC, type PhaseName } from '@quina/protocol';

/** Per Phase, the [low, high] range of the Heat the engine draws for it (0..1). */
export const HEAT_BANDS: Readonly<Record<PhaseName, readonly [number, number]>> = PROTOCOL_HEAT_BANDS;

/** The Pace the engine starts every round with, in seconds (a repeat's slot, D174). Prefer the snapshot's
 * `pace.defaultSec` when there is one. */
export const DEFAULT_PACE_SEC: number = PACE_DEFAULT_SEC.repeat;
