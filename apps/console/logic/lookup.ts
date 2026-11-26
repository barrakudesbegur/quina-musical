// The Cerca tab (D162, D170; PRIVATE, the tablet only): a song search over the round's songs, and a card's private
// preview (which of its songs have played, how many it misses, and with «Mostra el futur» when each missing song
// comes and whether the card can still win). Pure.
import type { SongRef } from '@quina/protocol';
import type { PlayerCard } from '../../../packages/rules/marks.ts';
import { cardFace, type CatalogCard } from '../../../packages/ui/data/catalog.ts';
import { fuzzyMatch, type MatchRange } from './fuzzy.ts';
import { missingOf } from './future.ts';
import { isNotSold, type CardsInPlay } from './possible-winners.ts';
import { completionOf, hasPlayed, songStatus, type Completion, type RoundSongs, type SongStatus, type WinForecast } from './upcoming.ts';

// ---- songs -----------------------------------------------------------------------------------------------------
/** The round's songs: the ones counted, the ones to come, and every song on the round's cards (its pool), so a song
 * can be looked up even before the engine sends the order. */
export function roundSongIds(songs: RoundSongs, cards: readonly PlayerCard[]): number[] {
  return [...new Set([...songs.played.keys(), ...(songs.upcoming ?? []), ...cards.flatMap((c) => c.lines.flat())])];
}

export interface SongHit {
  song: SongRef;
  /** Where the query matched, and the letters to highlight there. */
  field: 'title' | 'artist';
  ranges: MatchRange[];
  status: SongStatus;
}

/** The songs that match `query` by title or artist (the better of the two), best first. */
export function searchSongs(query: string, ids: readonly number[], info: (songId: number) => SongRef | null, songs: RoundSongs): SongHit[] {
  const hits: (SongHit & { cost: number })[] = [];
  for (const id of ids) {
    const song = info(id);
    if (!song) continue;
    const title = fuzzyMatch(query, song.title);
    const artist = song.artist ? fuzzyMatch(query, song.artist) : null;
    const best = title && (!artist || title.cost <= artist.cost) ? { field: 'title' as const, m: title } : artist ? { field: 'artist' as const, m: artist } : null;
    if (best) hits.push({ song, field: best.field, ranges: best.m.ranges, status: songStatus(songs, id), cost: best.m.cost });
  }
  return hits.sort((a, b) => a.cost - b.cost || a.song.title.localeCompare(b.song.title, 'ca')).map(({ cost: _, ...hit }) => hit);
}

// ---- a card ------------------------------------------------------------------------------------------------------
export interface CardCell {
  songId: number;
  /** 1-based. */
  row: number;
  status: SongStatus;
}

/** Whether the card can still win, with the order known (`chance` of a CardPeek). */
export type CardChance =
  /** It completes this win first, or as soon as the first card (tied). */
  | { canWin: true; kind: 'line' | 'bingo'; at: Completion }
  /** It can't: when its Line and its Quina come (null: never this round) against the first ones. The Line's part is
   * null once a Line is confirmed. */
  | {
      canWin: false;
      line: { missing: number; at: number | null; first: number } | null;
      bingo: { at: number | null; first: number | null };
    };

/** The Desgraciat round: the card is standing, or fell; with the order, when it falls. */
export interface StandingPeek {
  fallen: boolean;
  /** When its first song comes (null: none of them does this round, or no order). */
  fallsAt: Completion | null;
}

export type CardPeek =
  /** cards.json hasn't loaded: no card can be looked up. */
  | { status: 'noCards' }
  /** No printed card has this number. */
  | { status: 'unknown'; cardId: number }
  /** A card of another type, or without the round's side (an especial card in a side-2 round). */
  | { status: 'otherRound'; cardId: number; type: string }
  | {
      status: 'ok';
      cardId: number;
      type: string;
      notSold: boolean;
      cells: CardCell[];
      played: number;
      /** The fewest songs its rows miss for a Line, and the rows that miss that many (null once a Line is confirmed). */
      line: { missing: number; rows: number[] } | null;
      bingo: { missing: number };
      /** With the order: whether it can still win (null without the order, or in the Desgraciat round). */
      chance: CardChance | null;
      /** The Desgraciat round only. */
      standing: StandingPeek | null;
    };

export interface PeekInput {
  printed: ReadonlyMap<number, CatalogCard> | null;
  cardId: number;
  cardType: string;
  side: number;
  inPlay: CardsInPlay;
  songs: RoundSongs;
  lineConfirmed: boolean;
  /** The round's first Line and Quina (forecastWins), or null without the order. */
  forecast: { line: WinForecast | null; bingo: WinForecast | null } | null;
  /** The Desgraciat round: the engine's standing cards when it lists them (null: count from the card's songs). */
  standing: { cardIds: readonly number[] | null } | null;
}

export function peekCard({ printed, cardId, cardType, side, inPlay, songs, lineConfirmed, forecast, standing }: PeekInput): CardPeek {
  if (!printed) return { status: 'noCards' };
  const printedCard = printed.get(cardId);
  if (!printedCard) return { status: 'unknown', cardId };
  const card = printedCard.type === cardType ? cardFace(printedCard, side) : null;
  if (!card) return { status: 'otherRound', cardId, type: printedCard.type };

  const cells = card.lines.flatMap((line, r) => line.map((songId) => ({ songId, row: r + 1, status: songStatus(songs, songId) })));
  const landed = new Set(cells.filter((c) => hasPlayed(c.status)).map((c) => c.songId));
  const lineMissing = missingOf(card, landed, 'line');
  const base = {
    status: 'ok' as const,
    cardId,
    type: card.type,
    notSold: isNotSold(cardId, inPlay),
    cells,
    played: landed.size,
    line: lineConfirmed ? null : { missing: lineMissing, rows: card.lines.flatMap((l, i) => (l.filter((id) => !landed.has(id)).length === lineMissing ? [i + 1] : [])) },
    bingo: { missing: missingOf(card, landed, 'bingo') },
  };
  if (standing) {
    // A card falls with its first song (D180's "Salvats!" keeps a finalist up: the engine's list has the last word).
    const fallen = standing.cardIds ? !standing.cardIds.includes(cardId) : landed.size > 0;
    const firstSong = songs.upcoming ? cells.flatMap((c) => (c.status.state === 'ahead' ? [c.status.ahead] : [])) : [];
    const n = firstSong.length ? Math.min(...firstSong) : null;
    return { ...base, chance: null, standing: { fallen, fallsAt: fallen || n === null ? null : { n, rows: [], songId: songs.upcoming![n - 1] } } };
  }
  return { ...base, chance: forecast ? chanceOf(card, songs, forecast, base.line?.missing ?? 0) : null, standing: null };
}

/** The card's chance against the round's first wins. A Line counts only while none is confirmed (`forecast.line` is
 * null then); nothing counts after the round's Quina. */
function chanceOf(card: PlayerCard, songs: RoundSongs, forecast: { line: WinForecast | null; bingo: WinForecast | null }, lineMissing: number): CardChance {
  const end = forecast.bingo?.n ?? null;
  const line = forecast.line ? completionOf(card, songs, 'line') : null;
  const bingo = completionOf(card, songs, 'bingo');
  if (forecast.line && line && line.n <= forecast.line.n) return { canWin: true, kind: 'line', at: line };
  if (bingo && (end === null || bingo.n <= end)) return { canWin: true, kind: 'bingo', at: bingo };
  return {
    canWin: false,
    line: forecast.line ? { missing: lineMissing, at: line?.n ?? null, first: forecast.line.n } : null,
    bingo: { at: bingo?.n ?? null, first: end },
  };
}
