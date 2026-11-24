// Tempo matching for layering (same rules as analysis/steps/tempo_match.py): B can be beat-matched to A by
// pitch-preserving stretch when their tempos are within ±8% ("tight" within ±4%). Pure module.
import { LAYERING } from '../config.ts';

export type PairClass = 'tight' | 'direct' | 'none';

/** How B can be stretched onto A's tempo. `ratio` = speed applied to B (A's tempo / B's). */
export interface TempoMatch {
  pairClass: PairClass;
  ratio: number;
}

/** How B can be stretched onto A's tempo. Half/double-time matches (0.6% of pairs) are not used for blends. */
export function tempoMatch(aBpm: number, bBpm: number): TempoMatch {
  const ratio = aBpm / bBpm;
  const off = Math.abs(ratio - 1);
  if (!Number.isFinite(off)) return { pairClass: 'none', ratio };
  if (off <= LAYERING.tightStretch + 1e-9) return { pairClass: 'tight', ratio };
  if (off <= LAYERING.maxStretch + 1e-9) return { pairClass: 'direct', ratio };
  return { pairClass: 'none', ratio };
}
