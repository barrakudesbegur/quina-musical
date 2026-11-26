// The songs to come (`getUpcoming`, D170) on the console: when to ask, which answer to keep, where a song stands, when
// each card completes, the first Line and Quina and who gets them, and the Futur list's tags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoundInfo, ShowState, SongRef } from '@quina/protocol';
import { cardFace, type CatalogCard } from '../../../../../packages/ui/data/catalog.ts';
import { roundCards, roundKey, type LandingLog } from '../../../../console/logic/future.ts';
import { cardsInPlay } from '../../../../console/logic/possible-winners.ts';
import {
  acceptUpcoming,
  completionOf,
  forecastTargets,
  forecastWins,
  freshUpcoming,
  playedHistory,
  roundSongs,
  shouldAskUpcoming,
  songStatus,
  upcomingMoment,
  upcomingRows,
  wantsUpcoming,
  type RoundSongs,
} from '../../../../console/logic/upcoming.ts';
import { S } from '../../../../console/strings.ts';

const ROUND: RoundInfo = { number: 3, kind: 'normal', startedAtMs: 1000, targetEndMs: 0, lineConfirmed: false };
const at = (position: number, round: RoundInfo = ROUND) => ({ round, queue: { position, length: 24 } });
const ref = (songId: number): SongRef => ({ songId, title: `S${songId}`, artist: `A${songId}` });

/** The round so far: songs 1, 2, 3 landed (3 on air); then this order. */
const PLAYED = [1, 2, 3];
const UPCOMING = [13, 4, 14, 15, 16, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23, 24];
const logOf = (ids: readonly number[], from = 0): LandingLog => ({ key: roundKey(ROUND), songs: new Map(ids.map((id, i) => [from + i, id])) });
const current = (songId: number) => ({ songId }) as ShowState['current'];
const songsOf = (upcoming: readonly number[] | null = UPCOMING, log = logOf(PLAYED)): RoundSongs =>
  roundSongs(log, { ...at(2), current: current(3) }, upcoming && upcoming.map(ref));

/** Card 1: songs 1–12; card 2: 13–24; card 9 (unsold): 1, 2, 3, 13 on its first row, then 4–11. */
const card = (id: number, lines: number[][]): CatalogCard => ({ id, type: 'normal', sides: [{ side: 1, lines }] });
const PRINTED = new Map<number, CatalogCard>([
  [1, card(1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]])],
  [2, card(2, [[13, 14, 15, 16], [17, 18, 19, 20], [21, 22, 23, 24]])],
  [9, card(9, [[1, 2, 3, 13], [4, 5, 6, 7], [8, 9, 10, 11]])],
]);
const CARDS = roundCards(PRINTED, 'normal', 1);
const face = (id: number) => cardFace(PRINTED.get(id)!, 1)!;
const SOLD = cardsInPlay('1-2');

test('the order is asked for by Cerca and the revealed Futur only, once per moment, again after a landing', () => {
  assert.deepEqual([wantsUpcoming('search', false), wantsUpcoming('future', true), wantsUpcoming('future', false), wantsUpcoming('state', true)], [true, true, false, false]);
  const state = at(2);
  assert.equal(shouldAskUpcoming(true, state, null, null), true);
  assert.equal(shouldAskUpcoming(true, state, null, upcomingMoment(state)), false, 'already asked: wait for the answer');
  assert.equal(shouldAskUpcoming(false, state, null, null), false, 'no tab needs it');
  const answer = acceptUpcoming({ round: 3, position: 2, songs: UPCOMING.map(ref) }, state);
  assert.ok(answer);
  assert.equal(shouldAskUpcoming(true, state, answer, null), false, 'a fresh answer');
  // The next landing makes it stale: ask again.
  assert.equal(freshUpcoming(answer, at(3)), null);
  assert.equal(shouldAskUpcoming(true, at(3), answer, upcomingMoment(state)), true);
  // A new Shuffle of the same round number (a resumed round) too.
  assert.equal(freshUpcoming(answer, at(2, { ...ROUND, startedAtMs: 2000 })), null);
});

test('an answer is kept only when it is about the round and position on screen', () => {
  assert.equal(acceptUpcoming({ round: 3, position: 1, songs: [] }, at(2)), null, 'asked before a landing');
  assert.equal(acceptUpcoming({ round: 2, position: 2, songs: [] }, at(2)), null, 'another round');
  assert.equal(acceptUpcoming({ round: 3, position: 2, songs: [] }, null), null);
  assert.deepEqual(freshUpcoming(acceptUpcoming({ round: 3, position: 2, songs: [ref(13)] }, at(2)), at(2)), [ref(13)]);
});

test('where a song stands: on air, played (its place and how long ago), to come, or unknown', () => {
  const songs = songsOf();
  assert.deepEqual(songStatus(songs, 3), { state: 'now', place: 3 });
  assert.deepEqual(songStatus(songs, 1), { state: 'played', place: 1, ago: 2 });
  assert.deepEqual(songStatus(songs, 4), { state: 'ahead', ahead: 2 });
  assert.deepEqual(songStatus(songs, 99), { state: 'notYet' }, 'not in the Queue');
  // Without the order: a complete log can still say "not yet".
  assert.deepEqual(songStatus(songsOf(null), 4), { state: 'notYet' });
  // A console opened late saw only the last landing: songs not to come played earlier; without the order, unknown.
  const late = songsOf(UPCOMING, logOf([3], 2));
  assert.equal(late.complete, false);
  assert.deepEqual(songStatus(late, 1), { state: 'earlier' });
  assert.deepEqual(songStatus(songsOf(null, logOf([3], 2)), 1), { state: 'unknown' });
  // After Back the log's later index no longer counts.
  const back = roundSongs(logOf([1, 2, 3]), { ...at(1), current: current(2) }, null);
  assert.deepEqual(songStatus(back, 3), { state: 'notYet' });
});

test('the played history: newest first, with places and the one on air', () => {
  assert.deepEqual(playedHistory(songsOf()), [
    { songId: 3, place: 3, ago: 0, now: true },
    { songId: 2, place: 2, ago: 1, now: false },
    { songId: 1, place: 1, ago: 2, now: false },
  ]);
});

test("a card's completion: its first Line's rows and song, its Quina, or never", () => {
  const songs = songsOf();
  assert.deepEqual(completionOf(face(1), songs, 'line'), { n: 2, rows: [1], songId: 4 });
  assert.deepEqual(completionOf(face(1), songs, 'bingo'), { n: 13, rows: [], songId: 12 });
  assert.deepEqual(completionOf(face(2), songs, 'line'), { n: 5, rows: [1], songId: 16 });
  // A card that already has it (13 has landed): n = 0, no song.
  const after13 = roundSongs(logOf([...PLAYED, 13]), { ...at(3), current: current(13) }, UPCOMING.slice(1).map(ref));
  assert.deepEqual(completionOf(face(9), after13, 'line'), { n: 0, rows: [1], songId: null });
  // A song the rest of the Queue never brings: never; no order: never known.
  assert.equal(completionOf(face(1), songsOf(UPCOMING.filter((id) => id !== 12)), 'bingo'), null);
  assert.equal(completionOf(face(1), songsOf(null), 'line'), null);
});

test('the first Line and Quina: the first sold card sets it; unsold cards as soon or sooner are flagged', () => {
  const forecast = forecastWins(CARDS, SOLD, songsOf(), false);
  assert.ok(forecast?.line && forecast.bingo);
  assert.equal(forecast.line.n, 2, "card 1's Line; the unsold card 9 gets one at +1 but can't be the round's first");
  assert.deepEqual(forecast.line.winners, [
    { cardId: 9, rows: [1], songId: 13, notSold: true },
    { cardId: 1, rows: [1], songId: 4, notSold: false },
  ]);
  assert.equal(forecast.bingo.n, 13);
  assert.deepEqual(forecast.bingo.winners.map((w) => [w.cardId, w.notSold]), [[9, true], [1, false]]);
  // A confirmed Line: only the Quina. Without cards in play registered, every printed card counts.
  assert.equal(forecastWins(CARDS, SOLD, songsOf(), true)?.line, null);
  assert.equal(forecastWins(CARDS, cardsInPlay(''), songsOf(), false)?.line?.n, 1);
  assert.equal(forecastWins(CARDS, SOLD, songsOf(null), false), null, 'no order, no forecast');
});

test("the Futur's list: +N, songs left to the next win, the win itself, then nothing after the Quina", () => {
  const forecast = forecastWins(CARDS, SOLD, songsOf(), false)!;
  const targets = forecastTargets(forecast);
  assert.deepEqual(targets, [
    { kind: 'line', n: 2, cardIds: [9, 1] },
    { kind: 'bingo', n: 13, cardIds: [9, 1] },
  ]);
  const rows = upcomingRows(UPCOMING.map(ref), targets);
  assert.deepEqual(rows.slice(0, 3).map((r) => [r.n, r.song.songId, r.tag]), [
    [1, 13, { kind: 'count', toward: 'line', left: 1 }],
    [2, 4, { kind: 'win', wins: [targets[0]] }],
    [3, 14, { kind: 'count', toward: 'bingo', left: 10 }],
  ]);
  assert.deepEqual(rows[12].tag, { kind: 'win', wins: [targets[1]] });
  assert.equal(rows[13].tag, null, 'after the Quina the round is over');
  // Two wins on one song are one tag; a win a card already has (n = 0) is not counted down to.
  assert.deepEqual(upcomingRows([ref(1)], [{ kind: 'line', n: 1, cardIds: [] }, { kind: 'bingo', n: 1, cardIds: [] }])[0].tag, {
    kind: 'win',
    wins: [{ kind: 'line', n: 1, cardIds: [] }, { kind: 'bingo', n: 1, cardIds: [] }],
  });
  assert.deepEqual(forecastTargets({ line: { kind: 'line', n: 0, winners: [] }, bingo: null }), []);
  // The Desgraciat round counts down to the last card standing.
  assert.deepEqual(upcomingRows([ref(1), ref(2)], [{ kind: 'standing', n: 2, cardIds: [] }]).map((r) => r.tag?.kind), ['count', 'win']);
});

test("the list's tags, as the board says them", () => {
  assert.deepEqual([S.future.count('line', 3), S.future.count('line', 1), S.future.count('bingo', 26)], ['falten 3', 'falta 1', 'quina: falten 26']);
  assert.equal(S.future.win('line', [112, 204]), 'Línia · #112 #204');
  assert.equal(S.future.win('bingo', []), 'Quina');
  assert.equal(S.future.inSongs(4), "D'aquí a 4");
});
