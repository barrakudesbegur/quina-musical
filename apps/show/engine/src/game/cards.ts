// Cards in play, Lines and Bingos: pure functions shared by the engine, the tablet and the Node tests.
// No DOM and no Node-only APIs.
//
// A printed card is `{ id, type: 'normal' | 'especial', sides: [{ side: 1, lines: [[song × 4] × 3] }, …] }`, as in
// apps/cards/dist/cards.json, where a song is `{ id, title, artist }` (D178: each side is printed from one pool; a card
// from before sides has `lines`, its side 1). A round counts one side (`cardFace`): the functions below take those
// faces, `{ id, type, lines }`. Plain song ids work too (`lines: [[1, 2, 3, 4], …]`), which keeps synthetic cards in
// tests short. Song ids are the repertoire's, the same ids the mixer uses in data/analysis/index.json.
//
// API
//   parseCardRanges(text)                       → sorted unique card ids, e.g. "1-180, 200–215 400" (throws on junk)
//   cardFace(card, side)                        → the side's face { id, type, lines }, or null when it has none
//   validCards(allCards, inPlayIds, cardType, side) → the faces in play of the round's card type and side, by id
//   cardSongIds(card)                           → [[id × 4] × 3]
//   cardStatus(card, landed)                    → { lines: [b, b, b], lineCount, bingo, missing, missingByLine }
//   possibleWinners(cards, landed, kind)        → [{ cardId, lines, completedBy, card }] by card id
//   completionIndex(card, queuePos, kind)       → queue index at which the card first gets a Line/Bingo (Infinity if never)
//   completions(cards, queue, kind, from = 0)   → [{ cardId, index, lines }] sorted by index, then card id
//   firstWinAt(cards, queue, kind, from = 0)    → { index, songId, cardIds } or null
//   cardCounts(cards, landed)                   → { toLine, toBingo, marked }: histograms of the cards by songs
//
// The Desgraciat round (played in reverse: a card falls when one of its songs lands, the last one standing wins; a
// landing that would take every card left out counts for none of them, so exactly one is always left, D180):
//   standingRun(cards, songs)                   → { fallAt, standing, standingAfter, lastStandingAt, lastCardId } along songs
//   standingCards(cards, landed)                → the cards still standing after the landings (in order), by card id
//   standingCourse(cards, queue)                → { lastStandingAt, lastCardId, standingAfter }
//
// `landed` is the songs that have landed: a Set or an array (in landing order, which lets
// possibleWinners report the Winning song). `queue` is the round's song ids in order. `kind` is 'line' or
// 'bingo' (a CompletionKind: the Desgraciat round's 'standing' has its own functions). Everything derived from cards in play is "possible": the ranges include unsold cards.

import { DEFAULT_CARD_TYPE, DEFAULT_SIDE, isCardTypeId, type WinKind } from '@quina/protocol';

export type { WinKind } from '@quina/protocol';
/** What a card completes: a Line or its Bingo (the Desgraciat round's 'standing' is the opposite: nothing lands). */
export type CompletionKind = Exclude<WinKind, 'standing'>;

/** A song on a printed card. */
export interface CardSong {
  id: number;
  title?: string;
  artist?: string;
}
/** A song on a card, or just its id. */
export type CardSongRef = number | CardSong;
/** One side of a card as a round counts it: `type` is 'normal' or 'especial', `lines` are 3 lines of 4 songs. */
export interface Card {
  id: number;
  type: string;
  lines: ReadonlyArray<ReadonlyArray<CardSongRef>>;
}
/** A printed side: its number and its lines. */
export interface CardSide {
  side: number;
  lines: ReadonlyArray<ReadonlyArray<CardSongRef>>;
}
/** A printed card, as cards.json has it: its sides, or (from before sides) its side 1's `lines`. */
export interface PrintedCard {
  id: number;
  type: string;
  lines?: ReadonlyArray<ReadonlyArray<CardSongRef>>;
  sides?: ReadonlyArray<CardSide>;
}

/** The face a round of side `side` counts: that side's lines (a card from before sides: its `lines` on side 1). */
export function cardFace(card: PrintedCard, side: number = DEFAULT_SIDE): Card | null {
  if (!card.sides?.length) return side === DEFAULT_SIDE && card.lines ? (card as Card) : null; // itself: a card from before sides
  const lines = card.sides.find((s) => s.side === side)?.lines;
  return lines ? { id: card.id, type: card.type, lines } : null;
}
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

const songIdOf = (song: CardSongRef): number => (typeof song === 'object' && song !== null ? song.id : song);

/** @returns The card's song ids, line by line. */
export function cardSongIds(card: Card): number[][] {
  return card.lines.map((line) => line.map(songIdOf));
}

// ------------------------------------------------------------------------------------------ ranges

// parseCardRanges is the protocol's (screens parse the same ranges); re-exported for the engine's callers.
export { parseCardRanges } from '@quina/protocol';

/**
 * The cards in play that count in a round: those of the round's card type (`RoundInfo.cardType`: by default
 * 'normal' in regular rounds and 'especial' in the special round).
 * @param allCards  Every printed card, e.g. cards.json.
 * @param inPlayIds  Cards in play for the whole game, e.g. from parseCardRanges.
 * @param cardType  A card type id (cards.json `type`).
 * @returns Sorted by card id.
 * @throws On something that isn't a card type id.
 */
export function validCards(allCards: ReadonlyArray<PrintedCard>, inPlayIds: Iterable<number>, cardType: string = DEFAULT_CARD_TYPE.normal, side: number = DEFAULT_SIDE): Card[] {
  if (!isCardTypeId(cardType)) throw new Error(`Not a card type: ${cardType}`);
  const inPlay = inPlayIds instanceof Set ? inPlayIds : new Set(inPlayIds);
  return allCards
    .filter((card) => card.type === cardType && inPlay.has(card.id))
    .flatMap((card) => cardFace(card, side) ?? [])
    .sort((a, b) => a.id - b.id);
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
export function possibleWinners(cards: ReadonlyArray<Card>, landed: LandedSongs, kind: CompletionKind = 'line'): PossibleWinner[] {
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
export function completionIndex(card: Card, queuePos: ReadonlyMap<number, number>, kind: CompletionKind = 'line'): number {
  const ends = cardSongIds(card).map((line) => lineEnd(line, queuePos));
  return kind === 'bingo' ? Math.max(...ends) : Math.min(...ends);
}

/**
 * Every card's completion in the queue. Cards that complete before `from` are left out (they already had
 * their chance), and so are cards that never complete.
 * @param from  First queue index to consider.
 * @returns Sorted by index, then card id.
 */
export function completions(cards: ReadonlyArray<Card>, queue: ReadonlyArray<number>, kind: CompletionKind = 'line', from: number = 0): Completion[] {
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
export function firstWinAt(cards: ReadonlyArray<Card>, queue: ReadonlyArray<number>, kind: CompletionKind = 'line', from: number = 0): FirstWin | null {
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

// ------------------------------------------------------------------------------ the Desgraciat round

/**
 * The Desgraciat round along `songs` (landings in order, or the known Queue): a card falls at the first landing of one
 * of its songs, unless that landing would take every card still standing out; then it counts for none of them, and they
 * all stay in (D180: there is never a shared win, the round goes on until exactly one is left).
 */
export interface StandingRun {
  /** Each card that fell, by id: the index into `songs` of the landing that took it out. */
  fallAt: Map<number, number>;
  /** The cards still standing after every song, by card id. */
  standing: number[];
  /** standingAfter[i]: how many cards are still standing once songs[i] has landed. */
  standingAfter: number[];
  /** The index whose landing left exactly one card standing; −1 when only one card plays; null when more than one is
   * still standing at the end (or there are no cards). */
  lastStandingAt: number | null;
  /** The card left, once one is. */
  lastCardId: number | null;
}

export function standingRun(cards: ReadonlyArray<Card>, songs: ReadonlyArray<number>): StandingRun {
  const bySong = new Map<number, number[]>();
  for (const card of cards) for (const line of cardSongIds(card)) for (const id of line) (bySong.get(id) ?? bySong.set(id, []).get(id)!).push(card.id);
  const standing = new Set(cards.map((c) => c.id));
  const fallAt = new Map<number, number>();
  const standingAfter: number[] = [];
  let lastStandingAt: number | null = standing.size === 1 ? -1 : null;
  songs.forEach((songId, i) => {
    const hit = (bySong.get(songId) ?? []).filter((id) => standing.has(id));
    // A landing that would take everyone left out doesn't count for them.
    if (hit.length && hit.length < standing.size) {
      for (const id of hit) {
        standing.delete(id);
        fallAt.set(id, i);
      }
      if (standing.size === 1) lastStandingAt = i;
    }
    standingAfter.push(standing.size);
  });
  const left = [...standing].sort((a, b) => a - b);
  return { fallAt, standing: left, standingAfter, lastStandingAt: left.length === 1 ? lastStandingAt : null, lastCardId: left.length === 1 ? left[0] : null };
}

/** The cards still standing after `landed`, the landings in order (standingRun). Sorted by card id. */
export function standingCards<C extends Card>(cards: ReadonlyArray<C>, landed: ReadonlyArray<number>): C[] {
  const standing = new Set(standingRun(cards, landed).standing);
  return cards.filter((card) => standing.has(card.id)).sort((a, b) => a.id - b.id);
}

/** How a Desgraciat round unfolds along its known Queue (standingCourse). */
export interface StandingCourse {
  /** The queue index whose landing leaves exactly one card standing; −1 when only one card plays; null without cards. */
  lastStandingAt: number | null;
  /** That card. */
  lastCardId: number | null;
  /** standingAfter[i]: the cards still standing once queue[i] has landed. */
  standingAfter: number[];
}

/** The Desgraciat round along the known Queue: when one card is left standing, which, and the count after each song. */
export function standingCourse(cards: ReadonlyArray<Card>, queue: ReadonlyArray<number>): StandingCourse {
  const run = standingRun(cards, queue);
  return { lastStandingAt: run.lastStandingAt, lastCardId: run.lastCardId, standingAfter: run.standingAfter };
}
