// What the console knows about the round's wins (PRIVATE: presenters only, never the public feed, the projector or
// the phones), for the Estat and Futur tabs:
// - Estat: how many cards miss each number of songs for a Line (a Quina once the Line is confirmed), from the
//   engine's `future.toLine`/`toBingo`, or counted here from the printed cards (cards.json), the cards in play and
//   the round's counted songs;
// - Futur: the songs left until the first possible Line and Quina, exact from the engine's `future` (the Queue is
//   the engine's) or from the console's own forecast once the engine sent the order (`upcoming.ts`); else "now"
//   when the engine lists a possible winner, or only a lower bound (the fewest songs any card still misses); and
//   the engine's possible winners.
// The snapshot carries only the round's last 10 landings, so the console gathers the counted songs from the
// snapshots it sees (`recordLandings`): a console opened mid-round knows them all only after a short round.
// Pure.
import type { FutureInfo, PossibleWinners, RoundInfo, ShowState } from '@quina/protocol';
import { cardsForRound, type PlayerCard } from '../../../packages/rules/marks.ts';
import { cardFace, type CatalogCard } from '../../../packages/ui/data/catalog.ts';
import { possibleWinnersOf, possibleWinnersView, type CardsInPlay, type PossibleWinnersView } from './possible-winners.ts';
import type { WinForecast } from './upcoming.ts';

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
/** Every printed card of the round's card type (roundCardType), sold or not, by its face on the round's side
 * (roundSide). */
export function roundCards(printed: ReadonlyMap<number, CatalogCard>, cardType: string, side: number): PlayerCard[] {
  return cardsForRound([...printed.values()], cardType).flatMap((c) => cardFace(c, side) ?? []);
}

/** The printed cards that count this round: of its type and side (roundCards), and in play. */
export function validCards(printed: ReadonlyMap<number, CatalogCard>, inPlay: ReadonlySet<number>, cardType: string, side: number): PlayerCard[] {
  return roundCards(printed, cardType, side).filter((c) => inPlay.has(c.id));
}

/** The songs a card still misses for its closest Line, or for its Quina (a full card). */
export function missingOf(card: PlayerCard, landed: ReadonlySet<number>, kind: 'line' | 'bingo'): number {
  const missing = (ids: readonly number[]) => ids.filter((id) => !landed.has(id)).length;
  return kind === 'line' ? Math.min(...card.lines.map(missing)) : missing(card.lines.flat());
}

/** How many cards miss each number of songs (index = songs missing, 0 = it has it): the engine's `toLine`/`toBingo`,
 * counted here. */
export function missingCounts(cards: readonly PlayerCard[], landed: readonly number[], kind: 'line' | 'bingo'): number[] {
  const set = new Set(landed);
  const counts: number[] = [];
  for (const card of cards) {
    const m = missingOf(card, set, kind);
    while (counts.length <= m) counts.push(0);
    counts[m]++;
  }
  return counts;
}

/**
 * The fewest songs any card still misses for a Line (its closest line) or its Bingo: at least that many songs
 * must land before the first one can come. Null without cards.
 */
export function fewestMissing(cards: readonly PlayerCard[], landed: readonly number[], kind: 'line' | 'bingo'): number | null {
  const first = missingCounts(cards, landed, kind).findIndex((n) => n > 0);
  return first < 0 ? null : first;
}

// ---- Estat: the chart ----------------------------------------------------------------------------------------
/** The chart's rows go up to "4+": further than that, the exact number tells the presenters nothing. */
export const MISSING_ROWS = 4;

export interface MissingBar {
  /** Songs missing (0: they already have it). */
  missing: number;
  /** The last row, which also counts every card missing more ("Falten 4+"). */
  orMore: boolean;
  cards: number;
}

/** The chart's rows: 0, 1, 2, 3 and 4+ songs missing, every row drawn even when empty. */
export function missingBars(counts: readonly number[], rows: number = MISSING_ROWS): MissingBar[] {
  return Array.from({ length: rows + 1 }, (_, missing) => ({
    missing,
    orMore: missing === rows,
    cards: missing === rows ? counts.slice(rows).reduce((a, b) => a + b, 0) : (counts[missing] ?? 0),
  }));
}

/** Why the chart can't be drawn: no printed cards (cards.json), no cards in play, or not every counted song seen. */
export type ChartGap = 'cards' | 'inPlay' | 'landings';

export interface ChartInput {
  /** The engine's private future (ShowState.future): absent from an older engine, null without cards in play; the
   * console then counts what it can itself. */
  engine?: FutureInfo | null;
  /** The printed cards, or null until cards.json loads. */
  printed: ReadonlyMap<number, CatalogCard> | null;
  inPlay: CardsInPlay;
  /** The printed card type the round plays (roundCardType(state.round)). */
  cardType: string;
  /** The card side the round plays (roundSide(state.round)). */
  side: number;
  counted: CountedSongs;
  lineConfirmed: boolean;
}

export interface ChartView {
  /** What the cards are counted towards: the Line, then the Quina once the Line is confirmed. */
  kind: 'line' | 'bingo';
  /** Null when it can't be drawn (`gap` says why). */
  bars: MissingBar[] | null;
  gap: ChartGap | null;
  /** The cards counted this round, when known. */
  validCount: number | null;
}

export function chartView({ engine, printed, inPlay, cardType, side, counted, lineConfirmed }: ChartInput): ChartView {
  const kind = lineConfirmed ? 'bingo' : 'line';
  if (engine) {
    const counts = kind === 'line' ? engine.toLine : engine.toBingo;
    return { kind, bars: missingBars(counts), gap: null, validCount: counts.reduce((a, b) => a + b, 0) };
  }
  const gap: ChartGap | null = !printed || printed.size === 0 ? 'cards' : !inPlay.ids ? 'inPlay' : !counted.complete ? 'landings' : null;
  if (gap !== null || !printed || !inPlay.ids) return { kind, bars: null, gap, validCount: null };
  const cards = validCards(printed, inPlay.ids, cardType, side);
  return { kind, bars: missingBars(missingCounts(cards, counted.ids, kind)), gap: null, validCount: cards.length };
}

// ---- Futur: the songs to the first wins ------------------------------------------------------------------------
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

export interface FutureInput {
  /** The engine's private future (ShowState.future): exact, from the Queue. */
  engine?: FutureInfo | null;
  /** The Queue index of the last counted landing (`queue.position`). */
  position?: number;
  printed: ReadonlyMap<number, CatalogCard> | null;
  inPlay: CardsInPlay;
  cardType: string;
  side: number;
  counted: CountedSongs;
  possibleWinners: PossibleWinners;
  lineConfirmed: boolean;
  /** The console's forecast from the songs to come (forecastWins): exact too, when the engine sends no `future`. */
  forecast?: { line: WinForecast | null; bingo: WinForecast | null } | null;
}

export interface FutureView {
  line: SongsAhead;
  bingo: SongsAhead;
  /** The engine's possible winners: the cards that have a win now. */
  winners: PossibleWinnersView;
}

export function futureView({ engine, position = -1, printed, inPlay, cardType, side, counted, possibleWinners, lineConfirmed, forecast }: FutureInput): FutureView {
  const settled = (kind: 'line' | 'bingo'): SongsAhead | null =>
    kind === 'line' && lineConfirmed ? { state: 'done' } : possibleWinnersOf(possibleWinners, kind).length > 0 ? { state: 'now' } : null;
  const winners = possibleWinnersView(possibleWinners, inPlay);
  if (engine) {
    // The engine's numbers: exact, even on a console opened late.
    const at = (kind: 'line' | 'bingo'): SongsAhead => {
      const index = kind === 'line' ? engine.lineAt : engine.bingoAt;
      return settled(kind) ?? (index === null ? { state: 'never' } : { state: 'in', songs: Math.max(1, index - position) });
    };
    return { line: at('line'), bingo: at('bingo'), winners };
  }
  if (forecast) {
    const at = (kind: 'line' | 'bingo'): SongsAhead => {
      const win = forecast[kind];
      return settled(kind) ?? (!win ? { state: 'never' } : win.n === 0 ? { state: 'now' } : { state: 'in', songs: win.n });
    };
    return { line: at('line'), bingo: at('bingo'), winners };
  }
  const cards = printed && printed.size > 0 && inPlay.ids && counted.complete ? validCards(printed, inPlay.ids, cardType, side) : null;
  const ahead = (kind: 'line' | 'bingo'): SongsAhead => settled(kind) ?? { state: 'unknown', atLeast: cards ? fewestMissing(cards, counted.ids, kind) : null };
  return { line: ahead('line'), bingo: ahead('bingo'), winners };
}
