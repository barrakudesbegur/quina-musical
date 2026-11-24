// The Futur tab, the console's crystal ball (PRIVATE: presenters only, never the public feed, the projector or
// the phones). It shows what the console can know from what it is given:
// - how many cards have each number of marked songs: the printed cards (cards.json), the cards in play
//   valid this round, and the round's counted songs;
// - the songs left until the first possible Line and Quina: "now" when the engine already lists a possible
//   winner; otherwise the exact number needs the Queue's order, which the engine keeps to itself, so the
//   console only gives a lower bound (the fewest songs any card still misses);
// - the engine's possible winners.
// The snapshot carries only the round's last 10 landings, so the console gathers the counted songs from the
// snapshots it sees (`recordLandings`): a console opened mid-round knows them all only after a short round.
// Pure.
import type { FutureInfo, PossibleWinners, RoundInfo, ShowState } from '@quina/protocol';
import { cardMarks, cardsForRound, type PlayerCard } from '../../../packages/rules/marks.ts';
import type { WinKind } from '../../../packages/ui/flow.ts';
import { possibleWinnersOf, possibleWinnersView, type CardsInPlay, type PossibleWinnersView } from './possible-winners.ts';

// ---- the round's counted songs -------------------------------------------------------------------------
/** The songs seen at each Queue index this round. The Queue never changes after the Shuffle, so an index
 * always holds the same song, even after Back. */
export interface LandingLog {
  /** The round it belongs to (`roundKey`). */
  key: string;
  /** Queue index → song id. */
  songs: ReadonlyMap<number, number>;
}

export const EMPTY_LANDING_LOG: LandingLog = Object.freeze({ key: '', songs: new Map<number, number>() });

/** A round and its Shuffle: a new Shuffle (or a resumed round) starts a new log. */
export const roundKey = (round: Pick<RoundInfo, 'number' | 'kind' | 'startedAtMs'>): string => `${round.number}:${round.kind}:${round.startedAtMs}`;

/**
 * Add a snapshot's landings to the log. A new round, or a song that disagrees with one already seen at the
 * same index (a different Queue), starts it over. Returns the same log when nothing is new.
 */
export function recordLandings(log: LandingLog, state: Pick<ShowState, 'round' | 'landings'>): LandingLog {
  const key = roundKey(state.round);
  const same = log.key === key && state.landings.every((l) => (log.songs.get(l.position) ?? l.songId) === l.songId);
  const base = same ? log.songs : new Map<number, number>();
  const fresh = state.landings.filter((l) => base.get(l.position) !== l.songId);
  if (same && fresh.length === 0) return log;
  const songs = new Map(base);
  for (const l of fresh) songs.set(l.position, l.songId);
  return { key, songs };
}

export interface CountedSongs {
  /** The round's counted songs the console knows, in Queue order. */
  ids: number[];
  /** Every counted song (Queue indexes 0..position) is known. */
  complete: boolean;
}

/** The round's counted songs: the Queue's first `position + 1` (`queue.position`, after any Back). */
export function countedSongs(log: LandingLog, state: Pick<ShowState, 'round' | 'queue'>): CountedSongs {
  const position = state.queue.position;
  if (position < 0) return { ids: [], complete: true };
  if (log.key !== roundKey(state.round)) return { ids: [], complete: false };
  const ids: number[] = [];
  for (let p = 0; p <= position; p++) {
    const id = log.songs.get(p);
    if (id !== undefined) ids.push(id);
  }
  return { ids, complete: ids.length === position + 1 };
}

// ---- the cards ---------------------------------------------------------------------------------------------
/** The printed cards that count this round: in play, and of the round's card type (roundCardType). */
export function validCards(printed: ReadonlyMap<number, PlayerCard>, inPlay: ReadonlySet<number>, cardType: string): PlayerCard[] {
  return cardsForRound([...printed.values()].filter((c) => inPlay.has(c.id)), cardType);
}

/** How many cards have each number of marked songs: index n holds the cards with n songs landed. */
export function markHistogram(cards: readonly PlayerCard[], landed: readonly number[]): number[] {
  const size = cards.reduce((max, c) => Math.max(max, c.lines.reduce((n, line) => n + line.length, 0)), 0);
  const counts = new Array<number>(size + 1).fill(0);
  for (const card of cards) counts[cardMarks(card, landed).count]++;
  return counts;
}

export interface MarkBar {
  /** Songs marked. */
  marked: number;
  /** Cards with that many. */
  cards: number;
}

/** The chart's bars: from the most marked songs down to the fewest that any card has (empty rows inside kept). */
export function markBars(histogram: readonly number[]): MarkBar[] {
  const used = histogram.flatMap((n, marked) => (n > 0 ? [marked] : []));
  if (!used.length) return [];
  const bars: MarkBar[] = [];
  for (let marked = Math.max(...used); marked >= Math.min(...used); marked--) bars.push({ marked, cards: histogram[marked] });
  return bars;
}

/**
 * The fewest songs any card still misses for a Line (its closest line) or its Bingo: at least that many songs
 * must land before the first one can come. Null without cards.
 */
export function fewestMissing(cards: readonly PlayerCard[], landed: readonly number[], kind: WinKind): number | null {
  const set = new Set(landed);
  const missing = (ids: readonly number[]) => ids.filter((id) => !set.has(id)).length;
  let best: number | null = null;
  for (const card of cards) {
    const m = kind === 'line' ? Math.min(...card.lines.map(missing)) : missing(card.lines.flat());
    if (best === null || m < best) best = m;
  }
  return best;
}

// ---- the tab -----------------------------------------------------------------------------------------------
/**
 * How far the first possible Line or Quina is: a card already has it (`now`), the Line was confirmed this
 * round (`done`), or not known exactly (`unknown`, with a lower bound when the console can count one).
 */
export type SongsAhead =
  | { state: 'now' }
  | { state: 'done' }
  /** The engine knows the Queue: the first one comes in `songs` songs (1 = the next song). */
  | { state: 'in'; songs: number }
  /** The engine knows no card completes with the rest of this round's Queue. */
  | { state: 'never' }
  | { state: 'unknown'; atLeast: number | null };

/** Why the chart can't be drawn: no printed cards (cards.json), no cards in play, or not every counted song seen. */
export type ChartGap = 'cards' | 'inPlay' | 'landings';

export interface FutureInput {
  /** The engine's private future (ShowState.future): exact, from the Queue. Absent from an older engine, null
   * without cards in play; the console then counts what it can itself. */
  engine?: FutureInfo | null;
  /** The Queue index of the last counted landing (`queue.position`). */
  position?: number;
  /** The printed cards, or null until cards.json loads. */
  printed: ReadonlyMap<number, PlayerCard> | null;
  inPlay: CardsInPlay;
  /** The printed card type the round plays (roundCardType(state.round)). */
  cardType: string;
  counted: CountedSongs;
  possibleWinners: PossibleWinners;
  lineConfirmed: boolean;
}

export interface FutureView {
  /** Most marked first; null when it can't be drawn (`gap` says why). */
  bars: MarkBar[] | null;
  gap: ChartGap | null;
  /** The cards counted this round, when known. */
  validCount: number | null;
  line: SongsAhead;
  bingo: SongsAhead;
  winners: PossibleWinnersView;
}

export function futureView({ engine, position = -1, printed, inPlay, cardType, counted, possibleWinners, lineConfirmed }: FutureInput): FutureView {
  const settled = (kind: WinKind): SongsAhead | null =>
    kind === 'line' && lineConfirmed ? { state: 'done' } : possibleWinnersOf(possibleWinners, kind).length > 0 ? { state: 'now' } : null;
  if (engine) {
    // The engine's numbers: the whole round's marks and the exact songs ahead, even on a console opened late.
    const at = (kind: WinKind): SongsAhead => {
      const index = kind === 'line' ? engine.lineAt : engine.bingoAt;
      return settled(kind) ?? (index === null ? { state: 'never' } : { state: 'in', songs: Math.max(1, index - position) });
    };
    return {
      bars: markBars(engine.markCounts),
      gap: null,
      validCount: engine.markCounts.reduce((a, b) => a + b, 0),
      line: at('line'),
      bingo: at('bingo'),
      winners: possibleWinnersView(possibleWinners, inPlay),
    };
  }
  const gap: ChartGap | null = !printed || printed.size === 0 ? 'cards' : !inPlay.ids ? 'inPlay' : !counted.complete ? 'landings' : null;
  const cards = gap === null && printed && inPlay.ids ? validCards(printed, inPlay.ids, cardType) : null;
  const ahead = (kind: WinKind): SongsAhead => settled(kind) ?? { state: 'unknown', atLeast: cards ? fewestMissing(cards, counted.ids, kind) : null };
  return {
    bars: cards ? markBars(markHistogram(cards, counted.ids)) : null,
    gap,
    validCount: cards ? cards.length : null,
    line: ahead('line'),
    bingo: ahead('bingo'),
    winners: possibleWinnersView(possibleWinners, inPlay),
  };
}
