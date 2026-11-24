// What a player's card shows: which songs are marked, and which cards are 1 song away. Pure functions,
// shared by the player app (and anything else that draws a player's card). The rules come from the decisions:
// - Every counted landing of the round is marked, the latest song included.
// - The grace rule: if the latest song would complete the whole card (a Bingo), that card keeps it unmarked
//   until the next song lands or the round ends. A Line made by the latest song shows as plain marks; the
//   app never announces it.
// - When the round ends, everything is revealed.
// - The "1 song away" list names the card and the missing song. For a Line it only counts until someone's
//   Line is confirmed. For a Bingo it counts only marked songs, so the grace rule is never revealed.
// Proposed for @quina/rules (owned by the sound engine session) when the repo moves.

/** A card as the player app knows it: 3 lines of 4 song ids. */
export interface PlayerCard {
  id: number;
  /** 'normal' or 'especial', as in card-generator's cards.json. */
  type: string;
  lines: readonly (readonly number[])[];
}

export interface CardMarks {
  /** [line][slot]: is that song shown as marked. */
  marked: boolean[][];
  /** The song kept unmarked by the grace rule, or null. */
  heldBack: number | null;
  /** How many songs show as marked. */
  count: number;
}

export interface MarkOptions {
  /** The round is over (its Bingo was confirmed): reveal everything. */
  roundEnded: boolean;
}

/**
 * The marks a card shows, from the round's counted landings in landing order (undone ones removed).
 */
export function cardMarks(card: PlayerCard, landed: readonly number[], { roundEnded }: MarkOptions): CardMarks {
  const landedSet = new Set(landed);
  const latest = landed.length ? landed[landed.length - 1] : null;
  const songs = card.lines.flat();
  const all = songs.length > 0 && songs.every((id) => landedSet.has(id));
  const heldBack = !roundEnded && all && latest !== null && songs.includes(latest) ? latest : null;
  let count = 0;
  const marked = card.lines.map((line) =>
    line.map((id) => {
      const on = landedSet.has(id) && id !== heldBack;
      if (on) count++;
      return on;
    }),
  );
  return { marked, heldBack, count };
}

export interface NearWin {
  cardId: number;
  kind: 'line' | 'bingo';
  /** The line it is about (0–2) for a Line; null for a Bingo. */
  line: number | null;
  /** The song still missing. */
  missingSongId: number;
}

export interface NearWinOptions {
  /** Someone's Line was confirmed this round: Lines no longer count. */
  lineConfirmed: boolean;
  roundEnded: boolean;
}

/**
 * The ways a card is 1 song away, from the marks it shows. Several lines can each be 1 away; each is listed
 * once per missing song (two lines missing the same song are listed once, for the first line).
 */
export function nearWins(card: PlayerCard, marks: CardMarks, { lineConfirmed, roundEnded }: NearWinOptions): NearWin[] {
  if (roundEnded) return [];
  const out: NearWin[] = [];
  const missing: number[] = [];
  card.lines.forEach((line, li) =>
    line.forEach((id, si) => {
      if (!marks.marked[li]?.[si]) missing.push(id);
    }),
  );
  if (missing.length === 1) out.push({ cardId: card.id, kind: 'bingo', line: null, missingSongId: missing[0] });
  if (!lineConfirmed) {
    const seen = new Set<number>();
    card.lines.forEach((line, li) => {
      const gaps = line.filter((_, si) => !marks.marked[li]?.[si]);
      if (gaps.length === 1 && !seen.has(gaps[0])) {
        seen.add(gaps[0]);
        out.push({ cardId: card.id, kind: 'line', line: li, missingSongId: gaps[0] });
      }
    });
  }
  return out;
}

/** The cards that count in a round: special cards only in the special round, normal cards otherwise. */
export function cardsForRound<C extends PlayerCard>(cards: readonly C[], roundKind: 'normal' | 'special'): C[] {
  const want = roundKind === 'special' ? 'especial' : 'normal';
  return cards.filter((c) => c.type === want);
}
