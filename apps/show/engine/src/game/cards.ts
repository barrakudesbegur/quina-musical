// Cards in play, Lines and Bingos: pure functions shared by the engine, the tablet and the Node tests.
// No DOM and no Node-only APIs.
//
// A card is `{ id, type: 'normal' | 'especial', lines: [[song × 4] × 3] }`, as in
// apps/cards/dist/cards.json, where a song is `{ id, title, artist }`. Plain song ids work too
// (`lines: [[1, 2, 3, 4], …]`), which keeps synthetic cards in tests short. Song ids are the ids of the
// app's songs.json, the same ids the mixer uses in data/analysis/index.json.
//
// API
//   parseCardRanges(text)                       → sorted unique card ids, e.g. "1-180, 200–215 400" (throws on junk)
//   validCards(allCards, inPlayIds, cardType)  → the cards in play of the round's card type, by id
//   cardSongIds(card)                           → [[id × 4] × 3]
//   cardStatus(card, landed)                    → { lines: [b, b, b], lineCount, bingo, missing, missingByLine }
//   possibleWinners(cards, landed, kind)        → [{ cardId, lines, completedBy, card }] by card id
//   completionIndex(card, queuePos, kind)       → queue index at which the card first gets a Line/Bingo (Infinity if never)
//   completions(cards, queue, kind, from = 0)   → [{ cardId, index, lines }] sorted by index, then card id
//   firstWinAt(cards, queue, kind, from = 0)    → { index, songId, cardIds } or null
//   cardCounts(cards, landed)                   → { toLine, toBingo, marked }: histograms of the cards by songs
//
// `landed` is the songs that have landed: a Set or an array (in landing order, which lets
// possibleWinners report the Winning song). `queue` is the round's song ids in order. `kind` is 'line' or
// 'bingo'. Everything derived from cards in play is "possible": the ranges include unsold cards.

import { DEFAULT_CARD_TYPE, isCardTypeId, type RoundKind, type WinKind } from '@quina/protocol';

export type { WinKind } from '@quina/protocol';

/** A song on a printed card. */
export interface CardSong {
  id: number;
  title?: string;
  artist?: string;
}
/** A song on a card, or just its id. */
export type CardSongRef = number | CardSong;
/** A printed card: `type` is 'normal' or 'especial', `lines` are 3 lines of 4 songs. */
export interface Card {
  id: number;
  type: string;
  lines: ReadonlyArray<ReadonlyArray<CardSongRef>>;
}
/** A normal round, or the special round (special cards only). */
export type RoundType = RoundKind;
/** The songs that have landed: a Set, or an array in landing order. */
export type LandedSongs = ReadonlySet<number> | ReadonlyArray<number>;
export interface CardStatus {
  lines: boolean[];
  lineCount: number;
  bingo: boolean;
  missing: number[];
  missingByLine: number[][];
}
export interface PossibleWinner {
  cardId: number;
  lines: number[];
  /** The Winning song, when `landed` is in landing order. */
  completedBy: number | null;
  card: Card;
}
export interface Completion {
  cardId: number;
  index: number;
  lines: number[];
}
export interface FirstWin {
  index: number;
  songId: number;
  cardIds: number[];
}

export const ROWS = 3;
export const COLUMNS = 4;
/** @deprecated The protocol's DEFAULT_CARD_TYPE (a round's card type is now its own: `RoundInfo.cardType`). */
export const ROUND_TYPES: Readonly<Record<RoundType, string>> = DEFAULT_CARD_TYPE;
const MAX_RANGE_IDS = 100000;

const songIdOf = (song: CardSongRef): number => (typeof song === 'object' && song !== null ? song.id : song);

/** @returns The card's song ids, line by line. */
export function cardSongIds(card: Card): number[][] {
  return card.lines.map((line) => line.map(songIdOf));
}

// ------------------------------------------------------------------------------------------ ranges

/**
 * "1-180, 200–215, 400 - 460" → [1, …, 180, 200, …, 215, 400, …, 460]. Separators: commas, semicolons and
 * whitespace. Dashes: - ‐ ‑ ‒ – — −. A reversed range (20-10) reads as 10-20.
 * @returns Sorted unique card ids.
 * @throws On a token that isn't a number or a range, or a range of more than 100,000 ids.
 */
export function parseCardRanges(text: string | null | undefined): number[] {
  if (text == null) return [];
  const normalised = String(text)
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, '-');
  const ids = new Set<number>();
  for (const token of normalised.split(/[\s,;]+/)) {
    if (!token) continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) throw new Error(`Unrecognised card range: "${token}"`);
    let a = Number(match[1]);
    let b = match[2] == null ? a : Number(match[2]);
    if (a > b) [a, b] = [b, a];
    if (b - a + 1 + ids.size > MAX_RANGE_IDS) throw new Error(`Card range too large: "${token}"`);
    for (let id = a; id <= b; id++) ids.add(id);
  }
  return [...ids].sort((x, y) => x - y);
}

/**
 * The cards in play that count in a round: those of the round's card type (`RoundInfo.cardType`: by default
 * 'normal' in regular rounds and 'especial' in the special round).
 * @param allCards  Every printed card, e.g. cards.json.
 * @param inPlayIds  Cards in play for the whole game, e.g. from parseCardRanges.
 * @param cardType  A card type id (cards.json `type`).
 * @returns Sorted by card id.
 * @throws On something that isn't a card type id.
 */
export function validCards<C extends Card>(allCards: ReadonlyArray<C>, inPlayIds: Iterable<number>, cardType: string = DEFAULT_CARD_TYPE.normal): C[] {
  if (!isCardTypeId(cardType)) throw new Error(`Not a card type: ${cardType}`);
  const inPlay = inPlayIds instanceof Set ? inPlayIds : new Set(inPlayIds);
  return allCards.filter((card) => card.type === cardType && inPlay.has(card.id)).sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------------- lines and bingo

const asSet = (landed: LandedSongs): ReadonlySet<number> => (landed instanceof Set ? landed : new Set(landed));

export function cardStatus(card: Card, landed: LandedSongs): CardStatus {
  const set = asSet(landed);
  const missingByLine = cardSongIds(card).map((line) => line.filter((id) => !set.has(id)));
  const lines = missingByLine.map((missing) => missing.length === 0);
  const lineCount = lines.filter(Boolean).length;
  return { lines, lineCount, bingo: lineCount === lines.length, missing: missingByLine.flat(), missingByLine };
}

/**
 * The cards that now have a Line (or a Bingo), for the tablet's private "possible winners" list. When
 * `landed` is an array in landing order, `completedBy` is the Winning song: for a Line, the song that
 * completed the first line to complete; for a Bingo, the card's last song to land.
 * @param cards  The cards valid for the round.
 * @returns Sorted by card id.
 */
export function possibleWinners(cards: ReadonlyArray<Card>, landed: LandedSongs, kind: WinKind = 'line'): PossibleWinner[] {
  const order = Array.isArray(landed) ? new Map(landed.map((id, i) => [id, i])) : null;
  const set = asSet(landed);
  const out: PossibleWinner[] = [];
  for (const card of cards) {
    const status = cardStatus(card, set);
    if (kind === 'bingo' ? !status.bingo : status.lineCount === 0) continue;
    const lines = status.lines.flatMap((done, i) => (done ? [i] : []));
    let completedBy: number | null = null;
    if (order) {
      const rows = cardSongIds(card);
      const landedAt = (id: number) => order.get(id) ?? -1;
      const lastOf = (row: number[]) => row.reduce((best, id) => (landedAt(id) > landedAt(best) ? id : best), row[0]);
      const finishers = lines.map((i) => lastOf(rows[i]));
      completedBy = finishers.reduce((best, id) =>
        (kind === 'bingo' ? landedAt(id) > landedAt(best) : landedAt(id) < landedAt(best)) ? id : best,
      );
    }
    out.push({ cardId: card.id, lines, completedBy, card });
  }
  return out.sort((a, b) => a.cardId - b.cardId);
}

// ------------------------------------------------------------------------------- the known queue

/** @returns songId → queue index. */
export function queuePositions(queue: ReadonlyArray<number>): Map<number, number> {
  return new Map(queue.map((id, i) => [id, i]));
}

/** @returns The queue index at which the line completes; Infinity if one of its songs never lands. */
const lineEnd = (line: number[], queuePos: ReadonlyMap<number, number>): number => Math.max(...line.map((id) => queuePos.get(id) ?? Infinity));

/**
 * The queue index at which a card first gets a Line (or its Bingo).
 * @param queuePos  From queuePositions(queue). A song missing from the queue never lands.
 * @returns Infinity if it never does.
 */
export function completionIndex(card: Card, queuePos: ReadonlyMap<number, number>, kind: WinKind = 'line'): number {
  const ends = cardSongIds(card).map((line) => lineEnd(line, queuePos));
  return kind === 'bingo' ? Math.max(...ends) : Math.min(...ends);
}

/**
 * Every card's completion in the queue. Cards that complete before `from` are left out (they already had
 * their chance), and so are cards that never complete.
 * @param from  First queue index to consider.
 * @returns Sorted by index, then card id.
 */
export function completions(cards: ReadonlyArray<Card>, queue: ReadonlyArray<number>, kind: WinKind = 'line', from: number = 0): Completion[] {
  const pos = queuePositions(queue);
  const out: Completion[] = [];
  for (const card of cards) {
    const index = completionIndex(card, pos, kind);
    if (!Number.isFinite(index) || index < from) continue;
    const lines = cardSongIds(card).flatMap((line, i) => (lineEnd(line, pos) <= index ? [i] : []));
    out.push({ cardId: card.id, index, lines });
  }
  return out.sort((a, b) => a.index - b.index || a.cardId - b.cardId);
}

/**
 * The queue index (0-based) of the song whose landing first completes a Line/Bingo on any of the cards, at
 * or after `from`, and the cards it completes.
 * @returns null if no card ever completes.
 */
export function firstWinAt(cards: ReadonlyArray<Card>, queue: ReadonlyArray<number>, kind: WinKind = 'line', from: number = 0): FirstWin | null {
  const all = completions(cards, queue, kind, from);
  if (!all.length) return null;
  const index = all[0].index;
  return { index, songId: queue[index], cardIds: all.filter((c) => c.index === index).map((c) => c.cardId) };
}

/** Histograms of the cards (index = songs, value = cards); see cardCounts. */
export interface CardCounts {
  /** By songs still missing to their first Line (0 = it has one). */
  toLine: number[];
  /** By songs still missing to the Bingo (0 = full card). */
  toBingo: number[];
  /** By songs already marked. */
  marked: number[];
}

/** How far the cards are from a Line and a Bingo, and how many songs each has marked, as histograms. */
export function cardCounts(cards: ReadonlyArray<Card>, landed: LandedSongs): CardCounts {
  const set = asSet(landed);
  const toLine: number[] = [];
  const toBingo: number[] = [];
  const marked: number[] = [];
  const add = (list: number[], k: number) => {
    while (list.length <= k) list.push(0);
    list[k]++;
  };
  for (const card of cards) {
    const status = cardStatus(card, set);
    const songs = cardSongIds(card).flat().length;
    add(toLine, Math.min(...status.missingByLine.map((m) => m.length)));
    add(toBingo, status.missing.length);
    add(marked, songs - status.missing.length);
  }
  return { toLine, toBingo, marked };
}
