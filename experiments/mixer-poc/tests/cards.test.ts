import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCardRanges,
  validCards,
  cardStatus,
  cardSongIds,
  possibleWinners,
  completionIndex,
  completions,
  firstWinAt,
  queuePositions,
} from '../engine/src/game/cards.ts';
import { seededRandom, secureShuffle } from '../engine/src/rng.ts';
import type { Card, CardSong, FirstWin, RoundType } from '../engine/src/game/cards.ts';
import type { IndexSong } from '../engine/src/analysis.ts';

/** A card as card-generator/dist/cards.json prints it: songs as objects. */
interface PrintedCard extends Card {
  lines: CardSong[][];
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CARDS: PrintedCard[] = JSON.parse(fs.readFileSync(path.join(HERE, '../../../card-generator/dist/cards.json'), 'utf8'));
const INDEX: IndexSong[] = JSON.parse(fs.readFileSync(path.join(HERE, '../data/analysis/index.json'), 'utf8')).songs;
const NORMAL = CARDS.filter((c) => c.type === 'normal');
const POOL = Array.from({ length: 77 }, (_, i) => i + 1);
const ROUNDS = Number(process.env.CARD_SIM_ROUNDS || 1500);

const card = (id: number, lines: number[][], type = 'normal'): Card => ({ id, type, lines });
const A = card(1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
const B = card(2, [[1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]]);
const C = card(3, [[13, 14, 15, 25], [17, 18, 19, 20], [21, 22, 23, 24]]);

const percentile = (values: readonly number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(p * values.length))];
const share = (values: readonly number[], lo: number, hi: number) => values.filter((v) => v >= lo && v <= hi).length / values.length;
const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const describe = (values: readonly number[]) => `median ${percentile(values, 0.5)}, mean ${mean(values).toFixed(1)}, 10–90% ${percentile(values, 0.1)}–${percentile(values, 0.9)}`;

// ------------------------------------------------------------------------------------------ ranges

test('parseCardRanges reads the game-wide ranges', () => {
  const ids = parseCardRanges('1-180, 200-215, 400-460');
  assert.equal(ids.length, 180 + 16 + 61);
  assert.equal(ids[0], 1);
  assert.equal(ids.at(-1), 460);
  assert.ok(!ids.includes(181) && ids.includes(200) && ids.includes(215) && !ids.includes(216));
});

test('parseCardRanges tolerates spaces, dashes, separators, overlaps and reversed ranges', () => {
  assert.deepEqual(parseCardRanges(' 1 - 3 ,5,  7–9;10—11\n12 − 13 '), [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(parseCardRanges('5-3, 4, 4, 3-4'), [3, 4, 5]);
  assert.deepEqual(parseCardRanges('42'), [42]);
  assert.deepEqual(parseCardRanges(''), []);
  assert.deepEqual(parseCardRanges('  , ,'), []);
  assert.deepEqual(parseCardRanges(null), []);
});

test('parseCardRanges rejects junk and absurd ranges', () => {
  assert.throws(() => parseCardRanges('1-a'), /Unrecognised/);
  assert.throws(() => parseCardRanges('cards 1-10'), /Unrecognised/);
  assert.throws(() => parseCardRanges('1--5'), /Unrecognised/);
  assert.throws(() => parseCardRanges('1.5'), /Unrecognised/);
  assert.throws(() => parseCardRanges('1-1000000'), /too large/);
});

// -------------------------------------------------------------------------------------- validity

test('validCards: normal cards in regular rounds, special cards only in the special round', () => {
  const inPlay = parseCardRanges('1-180, 200-215, 400-460');
  const regular = validCards(CARDS, inPlay, 'normal');
  assert.equal(regular.length, 196);
  assert.ok(regular.every((c) => c.type === 'normal' && c.id < 400));
  assert.deepEqual(regular.map((c) => c.id), inPlay.filter((id) => id < 400));
  const special = validCards(CARDS, new Set(inPlay), 'special');
  assert.equal(special.length, 61);
  assert.ok(special.every((c) => c.type === 'especial' && c.id >= 400 && c.id <= 460));
  assert.deepEqual(validCards(CARDS, [], 'normal'), []);
  assert.deepEqual(validCards(CARDS, [5000], 'special'), []);
  const unchecked = 'bonus' as string as RoundType; // what an unchecked caller could pass
  assert.throws(() => validCards(CARDS, inPlay, unchecked), /Unknown round type/);
});

test('cards.json: 399 normal cards (1–399), 300 special (400–699), each 3 lines of 4 distinct songs', () => {
  assert.equal(NORMAL.length, 399);
  assert.ok(NORMAL.every((c) => c.id >= 1 && c.id <= 399));
  const special = CARDS.filter((c) => c.type === 'especial');
  assert.equal(special.length, 300);
  assert.ok(special.every((c) => c.id >= 400 && c.id <= 699));
  for (const c of CARDS) {
    const ids = cardSongIds(c);
    assert.equal(ids.length, 3);
    assert.ok(ids.every((line) => line.length === 4));
    assert.equal(new Set(ids.flat()).size, 12, `card ${c.id}`);
  }
});

test('card song ids are the mixer song ids (same id → same title and artist)', (t) => {
  const mixer = new Map(INDEX.map((s) => [s.id, s] as const));
  const onCards = new Map<number, CardSong>();
  for (const c of CARDS) for (const line of c.lines) for (const s of line) onCards.set(s.id, s);
  assert.equal(onCards.size, 77);
  for (const [id, s] of onCards) {
    const m = mixer.get(id);
    assert.ok(m, `song ${id} is on cards but not in the mixer index`);
    assert.equal(m.title, s.title, `song ${id} title`);
    assert.equal(m.artist, s.artist, `song ${id} artist`);
  }
  const excluded = INDEX.filter((s) => s.excluded && onCards.has(s.id));
  if (excluded.length) {
    const affected = CARDS.filter((c) => cardSongIds(c).flat().some((id) => excluded.some((s) => s.id === id)));
    t.diagnostic(
      `excluded from the mixer but printed on cards: ${excluded.map((s) => `${s.id} ${s.title}`).join(', ')}; ` +
        `on ${affected.length} of ${CARDS.length} cards, which can never get a Bingo (or a Line on that row) while excluded`,
    );
  }
});

// -------------------------------------------------------------------------------- lines and bingo

test('cardStatus finds Lines, the Bingo and what is missing', () => {
  let s = cardStatus(A, new Set([1, 2, 3, 5]));
  assert.deepEqual(s.lines, [false, false, false]);
  assert.equal(s.lineCount, 0);
  assert.equal(s.bingo, false);
  assert.deepEqual(s.missingByLine, [[4], [6, 7, 8], [9, 10, 11, 12]]);
  assert.deepEqual(s.missing, [4, 6, 7, 8, 9, 10, 11, 12]);

  s = cardStatus(A, [1, 2, 3, 4, 9, 10, 11, 12, 30]);
  assert.deepEqual(s.lines, [true, false, true]);
  assert.equal(s.lineCount, 2);
  assert.equal(s.bingo, false);

  s = cardStatus(A, POOL);
  assert.deepEqual(s.lines, [true, true, true]);
  assert.equal(s.bingo, true);
  assert.deepEqual(s.missing, []);
});

test('cardStatus reads cards.json cards (song objects)', () => {
  const real = CARDS[0];
  const ids = cardSongIds(real);
  const s = cardStatus(real, ids[1]);
  assert.deepEqual(s.lines, [false, true, false]);
  assert.deepEqual(s.missingByLine[0], ids[0]);
});

test('possibleWinners lists cards with a Line (or Bingo), the lines, and the Winning song', () => {
  const cards = [C, B, A];
  assert.deepEqual(possibleWinners(cards, [1, 2, 3], 'line'), []);

  // Landing order: 1 2 3 5 9 13 → B's first line [1, 5, 9, 13] completes on 13.
  let winners = possibleWinners(cards, [1, 2, 3, 5, 9, 13], 'line');
  assert.deepEqual(winners.map((w) => [w.cardId, w.lines, w.completedBy]), [[2, [0], 13]]);

  // Then 4: A's first line completes on 4. Sorted by card id.
  winners = possibleWinners(cards, [1, 2, 3, 5, 9, 13, 4], 'line');
  assert.deepEqual(winners.map((w) => [w.cardId, w.lines, w.completedBy]), [[1, [0], 4], [2, [0], 13]]);
  assert.equal(winners[0].card, A);

  // A Set has no order, so no Winning song.
  assert.equal(possibleWinners(cards, new Set([1, 2, 3, 4]), 'line')[0].completedBy, null);

  // Bingo: A complete, the Winning song is its last to land.
  const order = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  assert.deepEqual(possibleWinners(cards, [...order, 13], 'bingo').map((w) => [w.cardId, w.lines, w.completedBy]), [[1, [0, 1, 2], 1]]);
  assert.deepEqual(possibleWinners(cards, order.slice(1), 'bingo'), []);
  // The Line kind lists it too, with the line that completed first.
  assert.equal(possibleWinners([A], order, 'line')[0].completedBy, 9);
});

// --------------------------------------------------------------------------------- the known queue

test('completionIndex, completions and firstWinAt follow the queue', () => {
  const queue = [13, 1, 5, 2, 9, 3, 6, 4, 14, 10, 7, 8, 11, 12, 15, 16];
  const pos = queuePositions(queue);
  assert.equal(completionIndex(A, pos, 'line'), 7); // 1 2 3 4: 4 lands at index 7
  assert.equal(completionIndex(B, pos, 'line'), 4); // 1 5 9 13: 9 lands at index 4
  assert.equal(completionIndex(A, pos, 'bingo'), 13);
  assert.equal(completionIndex(C, pos, 'line'), Infinity); // 17–25 never land

  assert.deepEqual(firstWinAt([A, B, C], queue, 'line'), { index: 4, songId: 9, cardIds: [2] });
  assert.deepEqual(firstWinAt([A, B, C], queue, 'line', 5), { index: 7, songId: 4, cardIds: [1] });
  assert.deepEqual(firstWinAt([A, B, C], queue, 'bingo'), { index: 13, songId: 12, cardIds: [1] });
  assert.equal(firstWinAt([C], queue, 'line'), null);
  assert.equal(firstWinAt([], queue, 'line'), null);

  const all = completions([A, B, C], queue, 'line');
  assert.deepEqual(all.map((c) => [c.cardId, c.index]), [[2, 4], [1, 7]]);
});

test('firstWinAt reports every card that the same landing completes', () => {
  const twin = card(9, [[1, 2, 3, 4], [30, 31, 32, 33], [34, 35, 36, 37]]);
  const queue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.deepEqual(firstWinAt([twin, A], queue, 'line'), { index: 3, songId: 4, cardIds: [1, 9] });
});

test('firstWinAt agrees with possibleWinners replayed song by song', () => {
  const random = seededRandom(5);
  for (let round = 0; round < 40; round++) {
    const cards = secureShuffle(NORMAL, random).slice(0, 60);
    const queue = secureShuffle(POOL, random);
    for (const kind of ['line', 'bingo'] as const) {
      const first = firstWinAt(cards, queue, kind);
      let replayed: FirstWin | null = null;
      for (let i = 0; i < queue.length && replayed == null; i++) {
        const winners = possibleWinners(cards, queue.slice(0, i + 1), kind);
        if (winners.length) replayed = { index: i, songId: queue[i], cardIds: winners.map((w) => w.cardId) };
      }
      assert.deepEqual(first, replayed);
      assert.ok(first);
      assert.ok(possibleWinners(cards, queue.slice(0, first.index + 1), kind).every((w) => w.completedBy === first.songId));
    }
  }
});

// ---------------------------------------------------------------------------------- simulation

function simulate({ cardsFor, pool, rounds, random }: {
  cardsFor: (random: () => number) => Card[]; pool: readonly number[]; rounds: number; random: () => number;
}) {
  const line: number[] = [];
  const bingo: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const cards = cardsFor(random);
    const queue = secureShuffle(pool, random);
    const l = firstWinAt(cards, queue, 'line');
    assert.ok(l, 'every round has a Line');
    line.push(l.index + 1);
    const b = firstWinAt(cards, queue, 'bingo');
    if (b) bingo.push(b.index + 1);
  }
  return { line, bingo };
}

const syntheticCards = (n: number, random: () => number) =>
  Array.from({ length: n }, (_, i) => {
    const songs = secureShuffle(POOL, random).slice(0, 12);
    return card(i + 1, [songs.slice(0, 4), songs.slice(4, 8), songs.slice(8, 12)]);
  });

test(`simulation: 77 songs, 200 random normal cards from cards.json, ${ROUNDS} queues`, () => {
  const random = seededRandom(2026);
  const { line, bingo } = simulate({ cardsFor: (r) => secureShuffle(NORMAL, r).slice(0, 200), pool: POOL, rounds: ROUNDS, random });
  console.log(`  first Line (song number): ${describe(line)}, songs 11–21: ${(share(line, 11, 21) * 100).toFixed(0)}%`);
  console.log(`  Bingo (song number):      ${describe(bingo)}, songs 45–55: ${(share(bingo, 45, 55) * 100).toFixed(0)}%`);
  // Design decisions: Line around song 16 (80% between 11 and 21), Bingo about song 50 (45–55).
  assert.ok(percentile(line, 0.5) >= 14 && percentile(line, 0.5) <= 18);
  assert.ok(share(line, 11, 21) >= 0.7);
  assert.ok(percentile(bingo, 0.5) >= 47 && percentile(bingo, 0.5) <= 53);
  assert.ok(share(bingo, 45, 55) >= 0.65);
});

test('simulation: synthetic random cards and the special deck give the same picture', () => {
  const random = seededRandom(77);
  const rounds = Math.ceil(ROUNDS / 2);
  const synth = simulate({ cardsFor: (r) => syntheticCards(200, r), pool: POOL, rounds, random });
  const special = simulate({ cardsFor: (r) => secureShuffle(CARDS.filter((c) => c.type === 'especial'), r).slice(0, 200), pool: POOL, rounds, random });
  console.log(`  synthetic: Line ${describe(synth.line)}; Bingo ${describe(synth.bingo)}`);
  console.log(`  special:   Line ${describe(special.line)}; Bingo ${describe(special.bingo)}`);
  for (const { line, bingo } of [synth, special]) {
    assert.ok(Math.abs(percentile(line, 0.5) - 16) <= 2);
    assert.ok(Math.abs(percentile(bingo, 0.5) - 50) <= 3);
  }
});

test('simulation: more cards in play → earlier wins', () => {
  const random = seededRandom(9);
  const rounds = Math.ceil(ROUNDS / 3);
  const medians = [50, 120, 200, 300].map((n) => {
    const { line, bingo } = simulate({ cardsFor: (r) => secureShuffle(NORMAL, r).slice(0, n), pool: POOL, rounds, random });
    console.log(`  ${String(n).padStart(3)} cards: Line ${describe(line)}; Bingo ${describe(bingo)}`);
    return [percentile(line, 0.5), percentile(bingo, 0.5)];
  });
  for (let i = 1; i < medians.length; i++) {
    assert.ok(medians[i][0] <= medians[i - 1][0]);
    assert.ok(medians[i][1] <= medians[i - 1][1]);
  }
});
