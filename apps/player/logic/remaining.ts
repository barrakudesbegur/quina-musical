// The header's count (#72): the songs a card still needs, and the near-win cue's input. Builds on songsToGo and nearWins
// from packages/rules/marks.ts. Pure. The near-win highlight is gone (§8 Y1, 27 Nov, the user found it confusing; the
// song playing now is marked instead), but its chime and buzz are back (28 Nov: "the sound seems like a nice idea"):
// nothing on the card shows which song is missing (ANIMATIONS.md `near-win`).
import { nearWins, songsToGo, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
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

/** One of the phone's playing cards, as the near-win cue reads it. */
export interface NearCard {
  cardId: number;
  card: PlayerCard | null;
  marks: CardMarks | null;
}

/**
 * The near-win cue's input: "cardId:songId" for each song that is all a card is missing for a Line (until a Line is
 * confirmed) or for the Quina, in card order. Empty where songs aren't counted (as `remainingSongs`: no round, a card
 * that doesn't play, the Desgraciat round, after the round). Only the sound and the buzz use it, never the screen.
 */
export function nearKeys(cards: readonly NearCard[], round: CountRound | null): string[] {
  if (!round || round.ended || round.kind === 'desgraciat') return [];
  return cards.flatMap(({ cardId, card, marks }) => {
    if (!card || !marks) return [];
    const songs = new Set(nearWins(card, marks, { lineConfirmed: round.lineConfirmed, roundEnded: false }).map((w) => w.missingSongId));
    return [...songs].map((songId) => `${cardId}:${songId}`);
  });
}
