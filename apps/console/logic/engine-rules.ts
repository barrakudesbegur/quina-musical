// The engine's rules the console mirrors on screen, from @quina/protocol (the engine uses the same constants):
// - the Heat band of each Phase: the engine draws a round's Heat inside its Phase's band, so the band starts
//   are where each Phase starts on the header's Heat bar;
// - the default Pace of a round: the engine sets it at each Shuffle (and reports it as `pace.defaultSec`), and
//   the Pace panel recommends it.
import { HEAT_BANDS as PROTOCOL_HEAT_BANDS, defaultPaceSec, type PhaseName } from '@quina/protocol';

/** Per Phase, the [low, high] range of the Heat the engine draws for it (0..1). */
export const HEAT_BANDS: Readonly<Record<PhaseName, readonly [number, number]>> = PROTOCOL_HEAT_BANDS;

/** The Pace the engine starts a round with, in seconds (1-based round number). Prefer the snapshot's
 * `pace.defaultSec` when there is one. */
export const defaultPaceFor: (round: number) => number = defaultPaceSec;
