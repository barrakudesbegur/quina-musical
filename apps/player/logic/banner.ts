// The "1 song away" banner across all of a player's cards. It builds on packages/rules/marks.ts (cardMarks, nearWins,
// with the latest-song grace rule) and adds what the banner needs on top:
// - LATCHING. Once a card has been 1 song from a Line, that item stays up until someone's Line is confirmed;
//   once 1 song from Quina, until the round ends. So the banner never changes because the player's own card
//   completed, and the phone never says "you won". It is computed from every prefix of the round's landings,
//   so it needs no stored state and Back (an undone landing) undoes it naturally.
// - One item per card and prize, naming every missing song; a song a card needs for Quina isn't repeated
//   under its Line. Quina items first, then Lines, each in the player's card order.
// Pure.
import { cardMarks, nearWins, type PlayerCard } from '../../../packages/rules/marks.ts';

export interface BannerCard {
  card: PlayerCard;
  /** The --card-color-N token. */
  color: number;
  name: string | null;
}

export interface BannerItem {
  /** Stable while the item says the same thing; a new song makes a new key (the entrance animation). */
  key: string;
  cardId: number;
  color: number;
  name: string | null;
  kind: 'line' | 'bingo';
  /** The missing songs, in card order. */
  songIds: number[];
}

export interface BannerRound {
  lineConfirmed: boolean;
  ended: boolean;
}

/** Every near win the card has had during the round so far (by prize), from each prefix of the landings. */
function latchedNearWins(card: PlayerCard, landed: readonly number[], round: BannerRound): { line: Map<number, number>; bingo: number | null } {
  const line = new Map<number, number>(); // line index → missing song
  let bingo: number | null = null;
  for (let k = 0; k <= landed.length; k++) {
    const prefix = landed.slice(0, k);
    const wins = nearWins(card, cardMarks(card, prefix, { roundEnded: false }), { lineConfirmed: round.lineConfirmed, roundEnded: false });
    for (const w of wins) {
      if (w.kind === 'bingo') bingo ??= w.missingSongId;
      else if (w.line !== null && !line.has(w.line)) line.set(w.line, w.missingSongId);
    }
  }
  return { line, bingo };
}

/** The banner's items for these cards (only the ones valid for the round), from the round's landings in order. */
export function bannerItems(cards: readonly BannerCard[], landed: readonly number[], round: BannerRound): BannerItem[] {
  if (round.ended) return [];
  const bingoItems: BannerItem[] = [];
  const lineItems: BannerItem[] = [];
  for (const { card, color, name } of cards) {
    const { line, bingo } = latchedNearWins(card, landed, round);
    if (bingo !== null) bingoItems.push({ key: `bingo:${card.id}:${bingo}`, cardId: card.id, color, name, kind: 'bingo', songIds: [bingo] });
    if (round.lineConfirmed) continue;
    const order = card.lines.flat();
    const songs = [...new Set([...line.entries()].sort(([a], [b]) => a - b).map(([, song]) => song))]
      .filter((song) => song !== bingo)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (songs.length) lineItems.push({ key: `line:${card.id}:${songs.join('+')}`, cardId: card.id, color, name, kind: 'line', songIds: songs });
  }
  return [...bingoItems, ...lineItems];
}
