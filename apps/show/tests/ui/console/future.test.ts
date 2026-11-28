// The Estat and Futur tabs: the round's counted songs gathered from snapshots, Estat's chart of cards by songs
// missing, the Futur's songs to the first Line and Quina (exact from the engine, else a lower bound), and what shows
// "—" when the console can't know.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LandingInfo, PossibleWinners, RoundInfo } from '@quina/protocol';
import { cardFace, type CatalogCard } from '../../../../../packages/ui/data/catalog.ts';
import {
  EMPTY_LANDING_LOG,
  chartView,
  countedSongs,
  fewestMissing,
  futureView,
  missingBars,
  missingCounts,
  recordLandings,
  roundCards,
  validCards,
  type ChartInput,
  type FutureInput,
} from '../../../../console/logic/future.ts';
import { cardsInPlay } from '../../../../console/logic/possible-winners.ts';

const ROUND: RoundInfo = { number: 3, kind: 'normal', startedAtMs: 1000, targetEndMs: 0, lineConfirmed: false };
const landing = (position: number, songId: number, undone = false): LandingInfo => ({ songId, title: `S${songId}`, artist: '', position, atMs: position * 1000, undone });
const snapshot = (landings: LandingInfo[], round: RoundInfo = ROUND) => ({ round, landings });
const queue = (position: number) => ({ position, length: 77 });

/** 3 lines of 4 from song `first` on. */
const lines = (first: number) => [0, 1, 2].map((l) => [0, 1, 2, 3].map((s) => first + l * 4 + s));
/** Card 1 has songs 1–12 on side 1, card 2 songs 13–24, card 3 (special, one side) songs 1–12; a normal card's side 2
 * has the songs 40 on. */
const card = (id: number, first: number, type = 'normal'): CatalogCard => ({
  id,
  type,
  sides: [{ side: 1, lines: lines(first) }, ...(type === 'normal' ? [{ side: 2, lines: lines(first + 40) }] : [])],
});
const PRINTED = new Map<number, CatalogCard>([
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

test("the round's cards: every printed card of its type on its side; valid ones are also in play", () => {
  assert.deepEqual(roundCards(PRINTED, 'normal', 1).map((c) => c.id), [1, 2], 'sold or not');
  assert.deepEqual(roundCards(PRINTED, 'especial', 2), [], 'the especial card has no side 2');
  assert.deepEqual(validCards(PRINTED, new Set([1, 3]), 'normal', 1).map((c) => c.id), [1]);
  assert.deepEqual(validCards(PRINTED, new Set([1, 2, 3]), 'especial', 1).map((c) => c.id), [3]);
  assert.deepEqual(validCards(PRINTED, new Set([1, 2]), 'normal', 2).map((c) => c.lines[0]), [[41, 42, 43, 44], [53, 54, 55, 56]], "side 2's songs");
  assert.deepEqual(validCards(PRINTED, new Set([3]), 'especial', 2), [], 'the especial card has no side 2');
});

const side1 = (id: number) => cardFace(PRINTED.get(id)!, 1)!;

test("Estat's chart: cards by songs missing for a Line or the Quina, rows 0 to 4+", () => {
  const cards = [side1(1), side1(2)];
  assert.deepEqual(missingCounts(cards, [1, 2, 3, 13], 'line'), [0, 1, 0, 1], 'card 1 misses 1 (row 1), card 2 misses 3');
  assert.deepEqual(missingCounts(cards, [1, 2, 3, 13], 'bingo'), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1]);
  assert.deepEqual(
    missingBars([3, 12, 44, 91, 40, 20, 3]).map((b) => [b.missing, b.orMore, b.cards]),
    [[0, false, 3], [1, false, 12], [2, false, 44], [3, false, 91], [4, true, 63]],
    'the last row adds up every card missing 4 or more',
  );
  assert.deepEqual(missingBars([]).map((b) => b.cards), [0, 0, 0, 0, 0], 'every row drawn, even empty');
});

test('the fewest songs any card misses: a lower bound on the first Line and Quina', () => {
  const cards = [side1(1), side1(2)];
  assert.equal(fewestMissing(cards, [1, 2, 3], 'line'), 1);
  assert.equal(fewestMissing(cards, [1, 2, 3], 'bingo'), 9);
  assert.equal(fewestMissing(cards, [], 'line'), 4);
  assert.equal(fewestMissing([], [1], 'line'), null);
});

const chartInput = (over: Partial<ChartInput>): ChartInput => ({
  printed: PRINTED,
  inPlay: cardsInPlay('1-2'),
  cardType: 'normal',
  side: 1,
  counted: { ids: [1, 2, 3, 13], complete: true },
  lineConfirmed: false,
  ...over,
});

test('the chart counted here: towards the Line, then the Quina once the Line is confirmed', () => {
  const v = chartView(chartInput({}));
  assert.deepEqual([v.kind, v.gap, v.validCount], ['line', null, 2]);
  assert.deepEqual(v.bars?.map((b) => b.cards), [0, 1, 0, 1, 0]);
  const bingo = chartView(chartInput({ lineConfirmed: true }));
  assert.equal(bingo.kind, 'bingo');
  assert.deepEqual(bingo.bars?.map((b) => b.cards), [0, 0, 0, 0, 2], 'both cards miss 9 or more');
  // A side-2 round counts side 2's songs: the same landings mark nothing there.
  assert.deepEqual(chartView(chartInput({ side: 2 })).bars?.map((b) => b.cards), [0, 0, 0, 0, 2]);
});

test('the chart: what the console can’t count shows as a gap, never a guess', () => {
  assert.deepEqual(chartView(chartInput({ printed: null })), { kind: 'line', bars: null, gap: 'cards', validCount: null });
  assert.equal(chartView(chartInput({ inPlay: cardsInPlay('') })).gap, 'inPlay');
  assert.equal(chartView(chartInput({ counted: { ids: [13], complete: false } })).gap, 'landings');
});

test('the chart before the night: no histogram, whatever the console could count', () => {
  const engine = { lineAt: null, bingoAt: null, toLine: [0, 0, 0, 0, 210], toBingo: [0, 0, 0, 0, 210], markCounts: [] };
  assert.deepEqual(chartView(chartInput({ started: false })), { kind: 'line', bars: null, gap: 'before', validCount: null });
  assert.equal(chartView(chartInput({ engine, started: false })).bars, null);
});

test("the chart from the engine's future: the whole round, even on a console opened late", () => {
  const engine = { lineAt: 23, bingoAt: null, toLine: [0, 2, 1, 0, 3, 1], toBingo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 7], markCounts: [] };
  const v = chartView(chartInput({ engine, printed: null, counted: { ids: [], complete: false } }));
  assert.deepEqual([v.gap, v.validCount], [null, 7]);
  assert.deepEqual(v.bars?.map((b) => b.cards), [0, 2, 1, 0, 4]);
  assert.deepEqual(chartView(chartInput({ engine, lineConfirmed: true })).bars?.map((b) => b.cards), [0, 0, 0, 0, 7]);
});

const input = (over: Partial<FutureInput>): FutureInput => ({
  printed: PRINTED,
  inPlay: cardsInPlay('1-2'),
  cardType: 'normal',
  side: 1,
  counted: { ids: [1, 2, 3, 13], complete: true },
  possibleWinners: NO_WINNERS,
  lineConfirmed: false,
  ...over,
});

test('the Futur without the engine: lower bounds when every counted song is known', () => {
  const v = futureView(input({}));
  assert.deepEqual(v.line, { state: 'unknown', atLeast: 1 });
  assert.deepEqual(v.bingo, { state: 'unknown', atLeast: 9 });
  // A side-2 round counts side 2's songs: the same landings mark nothing there.
  assert.deepEqual(futureView(input({ side: 2 })).line, { state: 'unknown', atLeast: 4 });
  assert.deepEqual(futureView(input({ side: 2, counted: { ids: [41, 42, 43], complete: true } })).line, { state: 'unknown', atLeast: 1 });
});

test('the Futur: a listed possible winner is "now"; a confirmed Line is "done"', () => {
  const pw: PossibleWinners = { line: [{ cardId: 1, lines: [0], completedBy: 4 }], bingo: [] };
  const v = futureView(input({ possibleWinners: pw }));
  assert.deepEqual(v.line, { state: 'now' });
  assert.equal(v.winners.line[0].cardId, 1);
  assert.deepEqual(futureView(input({ lineConfirmed: true })).line, { state: 'done' });
});

test('the Futur without the engine: no bound it can’t count', () => {
  assert.deepEqual(futureView(input({ printed: null })).line, { state: 'unknown', atLeast: null });
  assert.deepEqual(futureView(input({ inPlay: cardsInPlay('') })).line, { state: 'unknown', atLeast: null });
  assert.deepEqual(futureView(input({ counted: { ids: [13], complete: false } })).bingo, { state: 'unknown', atLeast: null });
});

test("the Futur from the engine's future: exact songs ahead, even opened late", () => {
  const engine = { lineAt: 23, bingoAt: null, toLine: [0, 2, 1], toBingo: [], markCounts: [0, 1, 0, 2] };
  const v = futureView(input({ engine, position: 20, printed: null, counted: { ids: [], complete: false } }));
  assert.deepEqual(v.line, { state: 'in', songs: 3 });
  assert.deepEqual(v.bingo, { state: 'never' });
  assert.deepEqual(futureView(input({ engine, position: 22 })).line, { state: 'in', songs: 1 }, 'the next song');
  assert.deepEqual(futureView(input({ engine, lineConfirmed: true })).line, { state: 'done' });
});

test("the Futur from the console's own forecast (the engine's order, no engine future): exact too", () => {
  const win = (kind: 'line' | 'bingo', n: number) => ({ kind, n, winners: [] });
  assert.deepEqual(futureView(input({ forecast: { line: win('line', 4), bingo: win('bingo', 31) } })), {
    line: { state: 'in', songs: 4 },
    bingo: { state: 'in', songs: 31 },
    winners: { line: [], bingo: [], total: 0 },
  });
  assert.deepEqual(futureView(input({ forecast: { line: win('line', 0), bingo: null } })).line, { state: 'now' });
  assert.deepEqual(futureView(input({ forecast: { line: win('line', 0), bingo: null } })).bingo, { state: 'never' });
  assert.deepEqual(futureView(input({ lineConfirmed: true, forecast: { line: null, bingo: null } })).line, { state: 'done' });
});
