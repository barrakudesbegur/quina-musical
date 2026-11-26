// The round's songs as the console knows them (PRIVATE, presenters only): the counted ones (the landing log) and the
// ones to come, which the engine sends only when asked (`getUpcoming` → an `upcoming` event; never in the state, D170).
// From them: where any song stands (played, and how long ago; or how many songs ahead), when each card completes a
// Line or its Quina, the first ones to do it, and the Futur tab's upcoming list with what each song brings. Pure.
import type { EventOf, ShowState, SongRef } from '@quina/protocol';
import type { PlayerCard } from '../../../packages/rules/marks.ts';
import type { WinKind } from '../../../packages/ui/flow.ts';
import { roundKey, type LandingLog } from './future.ts';
import { isNotSold, type CardsInPlay } from './possible-winners.ts';
import type { HelperTab } from './standing.ts';

// ---- asking the engine -----------------------------------------------------------------------------------------
/** The engine's answer to `getUpcoming`, kept while it matches the round and position on screen. */
export interface UpcomingSongs {
  /** The round it answered for (`roundKey`) and its Queue position then. */
  key: string;
  position: number;
  /** In Queue order: `songs[k]` lands `k + 1` songs from now. */
  songs: readonly SongRef[];
}

type RoundAt = Pick<ShowState, 'round' | 'queue'>;

/** The moment an answer is for: a round's Shuffle and its position. */
export const upcomingMoment = (state: RoundAt): string => `${roundKey(state.round)}@${state.queue.position}`;

/** Keep an `upcoming` event when it answers for the round and position on screen (any console's request will do). */
export function acceptUpcoming(event: Pick<EventOf<'upcoming'>, 'round' | 'position' | 'songs'>, state: RoundAt | null): UpcomingSongs | null {
  if (!state || event.round !== state.round.number || event.position !== state.queue.position) return null;
  return { key: roundKey(state.round), position: event.position, songs: event.songs };
}

/** The songs to come, when the answer is still about the moment on screen; null when the console must ask again. */
export function freshUpcoming(upcoming: UpcomingSongs | null, state: RoundAt | null): readonly SongRef[] | null {
  return upcoming && state && upcoming.key === roundKey(state.round) && upcoming.position === state.queue.position ? upcoming.songs : null;
}

/** The tabs that need the order: Cerca (where a song or a card's songs stand) and the Futur once revealed. Estat is
 * the past only. */
export const wantsUpcoming = (tab: HelperTab, futureRevealed: boolean): boolean => tab === 'search' || (tab === 'future' && futureRevealed);

/** Whether to send `getUpcoming` now: a tab needs it, there is no fresh answer, and it wasn't already asked for this
 * moment (`asked`: the moment of the last request). */
export function shouldAskUpcoming(wanted: boolean, state: RoundAt | null, upcoming: UpcomingSongs | null, asked: string | null): boolean {
  return wanted && state !== null && freshUpcoming(upcoming, state) === null && asked !== upcomingMoment(state);
}

// ---- where a song stands -----------------------------------------------------------------------------------------
export interface RoundSongs {
  /** The counted songs this console saw: song id → Queue index. */
  played: ReadonlyMap<number, number>;
  /** The Queue index of the last counted landing (−1 before the first). */
  position: number;
  /** Every counted song is known (else a song missing from `played` may still have played). */
  complete: boolean;
  /** The songs to come, in order, when the engine answered for this moment. */
  upcoming: readonly number[] | null;
  /** The same as song id → songs ahead (1 = the next song). */
  ahead: ReadonlyMap<number, number> | null;
  /** The song on air: the last counted one while it plays. */
  nowId: number | null;
}

export function roundSongs(log: LandingLog, state: Pick<ShowState, 'round' | 'queue' | 'current'>, upcoming: readonly SongRef[] | null): RoundSongs {
  const position = state.queue.position;
  const played = new Map<number, number>();
  if (log.key === roundKey(state.round)) for (const [index, songId] of log.songs) if (index <= position) played.set(songId, index);
  const ids = upcoming ? upcoming.map((s) => s.songId) : null;
  return {
    played,
    position,
    complete: played.size === position + 1,
    upcoming: ids,
    ahead: ids ? new Map(ids.map((id, k) => [id, k + 1])) : null,
    nowId: state.current?.songId ?? null,
  };
}

/**
 * Where a song stands this round: on air (`now`), played (its place in the round, 1-based, and how many songs ago),
 * played at a place this console didn't see (`earlier`), to come (`ahead`: 1 = the next song), not played (with no
 * order to tell when), or `unknown` when the console can't tell.
 */
export type SongStatus =
  | { state: 'now'; place: number }
  | { state: 'played'; place: number; ago: number }
  | { state: 'earlier' }
  | { state: 'ahead'; ahead: number }
  | { state: 'notYet' }
  | { state: 'unknown' };

export function songStatus(songs: RoundSongs, songId: number): SongStatus {
  const index = songs.played.get(songId);
  if (index !== undefined) {
    const ago = songs.position - index;
    return ago === 0 && songs.nowId === songId ? { state: 'now', place: index + 1 } : { state: 'played', place: index + 1, ago };
  }
  if (songs.ahead) {
    const ahead = songs.ahead.get(songId);
    // Not counted and not to come: the Queue holds the round's every song, so it played before this console looked.
    return ahead !== undefined ? { state: 'ahead', ahead } : songs.complete ? { state: 'notYet' } : { state: 'earlier' };
  }
  return songs.complete ? { state: 'notYet' } : { state: 'unknown' };
}

export const hasPlayed = (status: SongStatus): boolean => status.state === 'now' || status.state === 'played' || status.state === 'earlier';

/** A played song in the round's history. */
export interface PlayedSong {
  songId: number;
  /** Its place in the round, 1-based. */
  place: number;
  /** Songs since (0: the last one). */
  ago: number;
  /** On air now. */
  now: boolean;
}

/** The counted songs this console saw, newest first, in the Shuffle's order. */
export function playedHistory(songs: RoundSongs): PlayedSong[] {
  return [...songs.played]
    .map(([songId, index]) => ({ songId, place: index + 1, ago: songs.position - index, now: index === songs.position && songs.nowId === songId }))
    .sort((a, b) => a.ago - b.ago);
}

// ---- when the cards complete -----------------------------------------------------------------------------------
/** How many songs from now a card's songs are all in: 0 when they already are, null when the rest of the Queue
 * never brings them (or the order isn't known). */
function songsUntil(songs: RoundSongs, ids: readonly number[]): number | null {
  let last = 0;
  for (const id of ids) {
    const status = songStatus(songs, id);
    if (hasPlayed(status)) continue;
    if (status.state !== 'ahead') return null;
    last = Math.max(last, status.ahead);
  }
  return last;
}

/** When a card completes a win: in `n` songs (0: it already has it), its rows (1-based; a Line's only), and the song
 * that completes it (null when it already has it). */
export interface Completion {
  n: number;
  rows: number[];
  songId: number | null;
}

/** When `card` completes its first Line or its Quina with the known order; null when it never does this round. */
export function completionOf(card: PlayerCard, songs: RoundSongs, kind: 'line' | 'bingo'): Completion | null {
  const at = (n: number | null): number | null => (n === null || songs.upcoming === null || n === 0 ? null : songs.upcoming[n - 1]);
  if (kind === 'bingo') {
    const n = songsUntil(songs, card.lines.flat());
    return n === null ? null : { n, rows: [], songId: at(n) };
  }
  const byRow = card.lines.map((line) => songsUntil(songs, line));
  const reached = byRow.filter((n): n is number => n !== null);
  if (!reached.length) return null;
  const n = Math.min(...reached);
  return { n, rows: byRow.flatMap((m, i) => (m === n ? [i + 1] : [])), songId: at(n) };
}

/** A card that completes a win first. */
export interface FirstWinner {
  cardId: number;
  rows: number[];
  songId: number | null;
  notSold: boolean;
}

/** The first win of a kind: in `n` songs (0: a card has it now), and the cards that get it. */
export interface WinForecast {
  kind: 'line' | 'bingo';
  n: number;
  winners: FirstWinner[];
}

/**
 * The first Line and Quina with the known order: the first sold card to complete each one (any printed card when the
 * cards in play aren't registered), and with it every card that completes it as soon or sooner, unsold ones flagged
 * ("No venut": a player may still hold one). The Line is null once confirmed; either is null when no card completes
 * it this round. Null when the order isn't known.
 */
export function forecastWins(
  cards: readonly PlayerCard[],
  inPlay: CardsInPlay,
  songs: RoundSongs,
  lineConfirmed: boolean,
): { line: WinForecast | null; bingo: WinForecast | null } | null {
  if (songs.upcoming === null) return null;
  const forecast = (kind: 'line' | 'bingo'): WinForecast | null => {
    const done = cards.flatMap((card) => {
      const c = completionOf(card, songs, kind);
      return c ? [{ card, c, notSold: isNotSold(card.id, inPlay) }] : [];
    });
    const sold = done.filter((d) => !d.notSold).map((d) => d.c.n);
    if (!sold.length) return null;
    const n = Math.min(...sold);
    const winners = done
      .filter((d) => d.c.n <= n)
      .sort((a, b) => a.c.n - b.c.n || a.card.id - b.card.id)
      .map((d) => ({ cardId: d.card.id, rows: d.c.rows, songId: d.c.songId, notSold: d.notSold }));
    return { kind, n, winners };
  };
  return { line: lineConfirmed ? null : forecast('line'), bingo: forecast('bingo') };
}

// ---- the Futur tab's list ------------------------------------------------------------------------------------------
/** A win the list counts down to: in `n` songs (1 = the next song), and the cards that get it (empty when unknown). */
export interface Target {
  kind: WinKind;
  n: number;
  cardIds: number[];
}

/** What an upcoming song brings: songs left until the next win (`count`), the win(s) it completes, or nothing (after
 * the round's last win). */
export type UpcomingTag = { kind: 'count'; toward: WinKind; left: number } | { kind: 'win'; wins: Target[] } | null;

export interface UpcomingRow {
  /** Songs from now: 1 = the next song. */
  n: number;
  song: SongRef;
  tag: UpcomingTag;
}

/** The targets from the forecast: its wins still to come (a win a card already has is not counted down to). */
export function forecastTargets(forecast: { line: WinForecast | null; bingo: WinForecast | null }): Target[] {
  return [forecast.line, forecast.bingo].flatMap((w) => (w && w.n > 0 ? [{ kind: w.kind, n: w.n, cardIds: w.winners.map((x) => x.cardId) }] : []));
}

/** The songs to come, each with how far ahead it is and what it brings (`targets` in any order). */
export function upcomingRows(songs: readonly SongRef[], targets: readonly Target[]): UpcomingRow[] {
  const sorted = [...targets].filter((t) => t.n > 0).sort((a, b) => a.n - b.n);
  return songs.map((song, k) => {
    const n = k + 1;
    const next = sorted.find((t) => t.n >= n);
    const tag: UpcomingTag = !next ? null : next.n === n ? { kind: 'win', wins: sorted.filter((t) => t.n === n) } : { kind: 'count', toward: next.kind, left: next.n - n };
    return { n, song, tag };
  });
}
