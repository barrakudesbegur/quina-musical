// Possible winners (PRIVATE, console only): the cards that have a Line or a Bingo after the last landing, as
// the engine lists them, flagged "no registrat com a venut" when they aren't among the cards in play. Also
// used by the Claim number pad to warn about an unsold card before it is claimed. Pure.
import type { PossibleWinner, PossibleWinners } from '@quina/protocol';
import { parseCardRanges } from '../../engine/src/game/cards.ts';
import type { WinKind } from '../../ui/flow.ts';

/** The cards in play as a set, when they can be known. */
export interface CardsInPlay {
  /** null when none are registered, or when the ranges can't be read. */
  ids: ReadonlySet<number> | null;
  /** The ranges couldn't be read. */
  error: boolean;
}

/** Parse `state.cards.inPlay` ("1-210, 400-440"). Never throws. */
export function cardsInPlay(ranges: string | null | undefined): CardsInPlay {
  if (!ranges || !ranges.trim()) return { ids: null, error: false };
  try {
    const ids = parseCardRanges(ranges);
    return { ids: ids.length ? new Set(ids) : null, error: false };
  } catch {
    return { ids: null, error: true };
  }
}

/** Flag a card only when the cards in play are known: with none registered, nothing can be called unsold. */
export function isNotSold(cardId: number, inPlay: CardsInPlay): boolean {
  return inPlay.ids !== null && !inPlay.ids.has(cardId);
}

export interface CandidateView {
  cardId: number;
  kind: WinKind;
  /** The completed rows, 1-based (empty for a Bingo). */
  rows: number[];
  /** The song whose landing completed it. */
  completedBy: number | null;
  notSold: boolean;
}

export interface PossibleWinnersView {
  line: CandidateView[];
  bingo: CandidateView[];
  total: number;
}

const view = (kind: WinKind, inPlay: CardsInPlay) => (w: PossibleWinner): CandidateView => ({
  cardId: w.cardId,
  kind,
  rows: kind === 'line' ? w.lines.map((l) => l + 1) : [],
  completedBy: w.completedBy,
  notSold: isNotSold(w.cardId, inPlay),
});

export function possibleWinnersView(pw: PossibleWinners, inPlay: CardsInPlay): PossibleWinnersView {
  const line = pw.line.map(view('line', inPlay));
  const bingo = pw.bingo.map(view('bingo', inPlay));
  return { line, bingo, total: line.length + bingo.length };
}
