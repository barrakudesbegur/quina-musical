// Phase effects live in config.ts. Until cards in play are wired in, the Phase comes from a
// "songs until a winner" placeholder that the presenters set.
import { isPhaseName } from '@quina/protocol';
import { PHASES, PHASE_PLACEHOLDER } from '../config.ts';
import type { PhaseEffects, PhaseName } from '../config.ts';

export { PHASES };

/**
 * @param songsUntilWinner  songs still to play, including the incoming one, until the first win
 * @param override  a presenter's Phase; it wins when it names one
 */
export function phaseFor(songsUntilWinner: number, override: PhaseName | null = null): PhaseEffects {
  if (isPhaseName(override)) return PHASES[override];
  const n = Number(songsUntilWinner);
  if (!Number.isFinite(n) || n > PHASE_PLACEHOLDER.midAt) return PHASES.early;
  if (n > PHASE_PLACEHOLDER.lateAt) return PHASES.mid;
  if (n > PHASE_PLACEHOLDER.finalAt) return PHASES.late;
  return PHASES.final;
}
