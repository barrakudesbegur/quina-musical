// The near-win cue on phones (decided 2026-11-24): no banner. When one of the player's cards is 1 song from a
// Line (until someone's Line is confirmed) or 1 song from the Quina, that missing song is gently highlighted on
// that card's grid. Nothing is ever announced: a card that completes just shows its marks, and players claim
// it themselves. Builds on cardMarks and nearWins from packages/rules/marks.ts. Pure. The Desgraciat round has no
// Line or Quina to be near, so it highlights nothing.
import { nearWins, songsToGo, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
import type { RoundKind } from '../feed/public.ts';

export interface NearRound {
  lineConfirmed: boolean;
  ended: boolean;
  /** Absent: a normal round. */
  kind?: RoundKind;
}

const NONE: ReadonlySet<number> = new Set();

/** The songs to highlight on one card: the missing song of each line that is 1 away, and the card's last one. */
export function nearSongs(card: PlayerCard | null, marks: CardMarks | null, round: NearRound | null): ReadonlySet<number> {
  if (!card || !marks || !round || round.ended || round.kind === 'desgraciat') return NONE;
  const wins = nearWins(card, marks, { lineConfirmed: round.lineConfirmed, roundEnded: false });
  return wins.length ? new Set(wins.map((w) => w.missingSongId)) : NONE;
}

/** Every highlighted song across the player's cards ("cardId:songId"), in card order: the near-win cue's input. */
export function nearKeys(cards: readonly { cardId: number; near: ReadonlySet<number> }[]): string[] {
  return cards.flatMap(({ cardId, near }) => [...near].map((songId) => `${cardId}:${songId}`));
}

/** The remaining-songs pill's count (#72): the songs the card still needs for a Line, or the Quina once a Line is
 * confirmed; null where songs aren't being counted (no round, a card that doesn't play, the Desgraciat round, after
 * the round). */
export function remainingSongs(card: PlayerCard | null, marks: CardMarks | null, round: NearRound | null): number | null {
  if (!card || !marks || !round || round.ended || round.kind === 'desgraciat') return null;
  return songsToGo(card, marks, round);
}
