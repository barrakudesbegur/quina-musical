// The header's count (#72): the songs a card still needs. Builds on songsToGo from packages/rules/marks.ts. Pure.
// (The near-win highlight that lived here is gone: §8 Y1, 27 Nov, the user found it confusing; the song playing now is
// marked instead.)
import { songsToGo, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
import type { RoundKind } from '../feed/public.ts';

export interface CountRound {
  lineConfirmed: boolean;
  ended: boolean;
  /** Absent: a normal round. */
  kind?: RoundKind;
}

/** The remaining-songs pill's count (#72): the songs the card still needs for a Line, or the Quina once a Line is
 * confirmed; null where songs aren't being counted (no round, a card that doesn't play, the Desgraciat round, after
 * the round). */
export function remainingSongs(card: PlayerCard | null, marks: CardMarks | null, round: CountRound | null): number | null {
  if (!card || !marks || !round || round.ended || round.kind === 'desgraciat') return null;
  return songsToGo(card, marks, round);
}
