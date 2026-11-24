// The Futur tab: the round's counted songs gathered from snapshots, the marks chart, the lower bound on the
// first Line and Quina, and what shows "—" when the console can't know.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LandingInfo, PossibleWinners, RoundInfo } from '@quina/protocol';
import type { PlayerCard } from '../../../../../packages/rules/marks.ts';
import {
  EMPTY_LANDING_LOG,
  countedSongs,
  fewestMissing,
  futureView,
  markBars,
  markHistogram,
  recordLandings,
  validCards,
  type FutureInput,
} from '../../../../console/logic/future.ts';
import { cardsInPlay } from '../../../../console/logic/possible-winners.ts';

const ROUND: RoundInfo = { number: 3, kind: 'normal', startedAtMs: 1000, targetEndMs: 0, lineConfirmed: false };
const landing = (position: number, songId: number, undone = false): LandingInfo => ({ songId, title: `S${songId}`, artist: '', position, atMs: position * 1000, undone });
const snapshot = (landings: LandingInfo[], round: RoundInfo = ROUND) => ({ round, landings });
const queue = (position: number) => ({ position, length: 77 });

/** 3 lines of 4: card 1 has songs 1–12, card 2 songs 13–24, card 3 (special) songs 1–12. */
const card = (id: number, first: number, type = 'normal'): PlayerCard => ({
  id,
  type,
  lines: [0, 1, 2].map((l) => [0, 1, 2, 3].map((s) => first + l * 4 + s)),
});
const PRINTED = new Map<number, PlayerCard>([
  [1, card(1, 1)],
  [2, card(2, 13)],
  [3, card(3, 1, 'especial')],
]);
const NO_WINNERS: PossibleWinners = { line: [], bingo: [] };

test('landings gather across snapshots; each index keeps its song', () => {
  let log = recordLandings(EMPTY_LANDING_LOG, snapshot([landing(0, 1), landing(1, 2)]));
  log = recordLandings(log, snapshot([landing(1, 2), landing(2, 3)]));
  assert.deepEqual([...log.songs.entries()], [[0, 1], [1, 2], [2, 3]]);
  assert.equal(recordLandings(log, snapshot([landing(2, 3)])), log, 'nothing new: the same log');
});

test('a new round, or a different song at a known index (a new Queue), starts the log over', () => {
  const log = recordLandings(EMPTY_LANDING_LOG, snapshot([landing(0, 1), landing(1, 2)]));
  const next = recordLandings(log, snapshot([landing(0, 9)], { ...ROUND, number: 4 }));
  assert.deepEqual([...next.songs.entries()], [[0, 9]]);
  const reshuffled = recordLandings(log, snapshot([landing(1, 7)]));
  assert.deepEqual([...reshuffled.songs.entries()], [[1, 7]]);
});

test('counted songs: the Queue up to its position, complete only when every index was seen', () => {
  const log = recordLandings(EMPTY_LANDING_LOG, snapshot([landing(0, 1), landing(1, 2), landing(2, 3, true)]));
  // After Back the position is 1: the undone song no longer counts.
  assert.deepEqual(countedSongs(log, { round: ROUND, queue: queue(1) }), { ids: [1, 2], complete: true });
  assert.deepEqual(countedSongs(log, { round: ROUND, queue: queue(4) }), { ids: [1, 2, 3], complete: false });
  assert.deepEqual(countedSongs(log, { round: ROUND, queue: queue(-1) }), { ids: [], complete: true }, 'before the first song');
  assert.equal(countedSongs(log, { round: { ...ROUND, number: 4 }, queue: queue(0) }).complete, false, 'another round');
  // A console opened mid-round: the snapshot's last 10 landings start at index 7.
  const late = recordLandings(EMPTY_LANDING_LOG, snapshot(Array.from({ length: 10 }, (_, i) => landing(7 + i, 30 + i))));
  assert.equal(countedSongs(late, { round: ROUND, queue: queue(16) }).complete, false);
});

test("valid cards: in play and of the round's card type", () => {
  assert.deepEqual(validCards(PRINTED, new Set([1, 3]), 'normal').map((c) => c.id), [1]);
  assert.deepEqual(validCards(PRINTED, new Set([1, 2, 3]), 'especial').map((c) => c.id), [3]);
});

test('the marks chart: cards per number of marked songs, most marked first', () => {
  const cards = [PRINTED.get(1)!, PRINTED.get(2)!];
  const histogram = markHistogram(cards, [1, 2, 3, 13]);
  assert.equal(histogram.length, 13, '0 to 12 marked songs');
  assert.equal(histogram[3], 1);
  assert.equal(histogram[1], 1);
  assert.deepEqual(markBars(histogram), [
    { marked: 3, cards: 1 },
    { marked: 2, cards: 0 },
    { marked: 1, cards: 1 },
  ]);
  assert.deepEqual(markBars(new Array<number>(13).fill(0)), []);
});

test('the fewest songs any card misses: a lower bound on the first Line and Quina', () => {
  const cards = [PRINTED.get(1)!, PRINTED.get(2)!];
  assert.equal(fewestMissing(cards, [1, 2, 3], 'line'), 1);
  assert.equal(fewestMissing(cards, [1, 2, 3], 'bingo'), 9);
  assert.equal(fewestMissing(cards, [], 'line'), 4);
  assert.equal(fewestMissing([], [1], 'line'), null);
});

const input = (over: Partial<FutureInput>): FutureInput => ({
  printed: PRINTED,
  inPlay: cardsInPlay('1-2'),
  cardType: 'normal',
  counted: { ids: [1, 2, 3, 13], complete: true },
  possibleWinners: NO_WINNERS,
  lineConfirmed: false,
  ...over,
});

test('the view: chart and lower bounds when everything is known', () => {
  const v = futureView(input({}));
  assert.equal(v.gap, null);
  assert.equal(v.validCount, 2);
  assert.deepEqual(v.bars?.map((b) => b.marked), [3, 2, 1]);
  assert.deepEqual(v.line, { state: 'unknown', atLeast: 1 });
  assert.deepEqual(v.bingo, { state: 'unknown', atLeast: 9 });
});

test('the view: a listed possible winner is "now"; a confirmed Line is "done"', () => {
  const pw: PossibleWinners = { line: [{ cardId: 1, lines: [0], completedBy: 4 }], bingo: [] };
  const v = futureView(input({ possibleWinners: pw }));
  assert.deepEqual(v.line, { state: 'now' });
  assert.equal(v.winners.line[0].cardId, 1);
  assert.deepEqual(futureView(input({ lineConfirmed: true })).line, { state: 'done' });
});

test('the view: what the console can’t know shows as a gap, never a guess', () => {
  const noCards = futureView(input({ printed: null }));
  assert.equal(noCards.gap, 'cards');
  assert.equal(noCards.bars, null);
  assert.deepEqual(noCards.line, { state: 'unknown', atLeast: null });
  assert.equal(futureView(input({ inPlay: cardsInPlay('') })).gap, 'inPlay');
  const partial = futureView(input({ counted: { ids: [13], complete: false } }));
  assert.equal(partial.gap, 'landings');
  assert.equal(partial.validCount, null);
  assert.deepEqual(partial.bingo, { state: 'unknown', atLeast: null });
});

test("the view: the engine's future gives exact songs ahead and the whole round's chart, even opened late", () => {
  const engine = { lineAt: 23, bingoAt: null, toLine: [0, 2, 1], toBingo: [], markCounts: [0, 1, 0, 2] };
  const v = futureView(input({ engine, position: 20, printed: null, counted: { ids: [], complete: false } }));
  assert.equal(v.gap, null, 'no gap: the engine counted every song');
  assert.equal(v.validCount, 3);
  assert.deepEqual(v.bars?.map((b) => [b.marked, b.cards]), [[3, 2], [2, 0], [1, 1]]);
  assert.deepEqual(v.line, { state: 'in', songs: 3 });
  assert.deepEqual(v.bingo, { state: 'never' });
  assert.deepEqual(futureView(input({ engine, position: 22 })).line, { state: 'in', songs: 1 }, 'the next song');
  assert.deepEqual(futureView(input({ engine, lineConfirmed: true })).line, { state: 'done' });
});
