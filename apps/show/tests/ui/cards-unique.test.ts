// The printed cards repeat no card and no line (requirements › songs-and-cards, docs/event.md): apps/cards checks each
// new card's lines against every line drawn so far, across all card types, and fails rather than print a repeat. Since
// cards have sides (D178), that holds per pool: each side is drawn from its pool (apps/cards/src/sides.ts) and checked
// against the sides drawn from the same pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRAW_ATTEMPTS, Drawn, DrawnByPool, cardKey, drawUnique, lineKey, repeatedCards, repeatedLines, type LinedCard } from '../../../cards/src/uniqueness.ts';
import { drawCard, poolProblems, sideSeed, sideSources, sidesByPool, sourceWarnings, type DrawnCard } from '../../../cards/src/sides.ts';
import { seededRandom } from '../../../cards/src/report.ts';

const songs = (...ids: number[]) => ids.map((id) => ({ id }));
const card = (id: number, ...lines: number[][]): LinedCard => ({ id, lines: lines.map((l) => songs(...l)) });

/** A card the generator's way: 12 songs from a seeded shuffle of the pool, in 3 lines of 4. */
function drawFrom(pool: number, id: number, seed: number): LinedCard {
  const rnd = seededRandom(seed);
  const ids = Array.from({ length: pool }, (_, i) => i + 1);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return card(id, ids.slice(0, 4), ids.slice(4, 8), ids.slice(8, 12));
}

test('a line is its songs, whatever their order; a card is all its songs, whatever their lines', () => {
  assert.equal(lineKey(songs(9, 3, 62, 45)), lineKey(songs(3, 9, 45, 62)));
  assert.equal(lineKey(songs(1, 2, 10, 3)), '1,2,3,10', 'numeric order, not text order');
  assert.equal(cardKey(card(1, [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12])), cardKey(card(2, [9, 10, 11, 12], [4, 3, 2, 1], [5, 6, 7, 8])));
});

test('a new card is refused when one of its lines is already on any card (the old check never caught it)', () => {
  const drawn = new Drawn();
  drawn.add(card(186, [1, 2, 3, 4], [3, 9, 45, 62], [5, 6, 7, 8]));
  // 2025's #398 repeated #186's second line in another place and order: a different card, the same line.
  assert.equal(drawn.fits(card(398, [62, 45, 9, 3], [10, 11, 12, 13], [14, 15, 16, 17])), false);
  assert.equal(drawn.fits(card(399, [10, 11, 12, 13], [14, 15, 16, 17], [18, 19, 20, 21])), true);
  assert.equal(drawn.fits(card(400, [5, 6, 7, 8], [1, 2, 3, 4], [3, 9, 45, 62])), false, 'the same card, its lines in another order');
});

test('one record for the whole print run: an especial card may not repeat a normal card\'s line', () => {
  const drawn = new Drawn();
  drawn.add(card(158, [1, 2, 3, 4], [5, 6, 7, 8], [19, 43, 52, 59]));
  assert.equal(drawn.fits(card(492, [10, 11, 12, 13], [14, 15, 16, 17], [59, 52, 43, 19])), false);
});

test('drawUnique takes the next draw that fits, and fails (nothing printed) when none does', () => {
  const drawn = new Drawn();
  drawn.add(card(1, [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]));
  const tries: number[] = [];
  const got = drawUnique((i) => (tries.push(i), i === 0 ? card(2, [4, 3, 2, 1], [20, 21, 22, 23], [24, 25, 26, 27]) : card(2, [30, 31, 32, 33], [34, 35, 36, 37], [38, 39, 40, 41])), drawn);
  assert.deepEqual(tries, [0, 1], 'the first draw repeats a line, the second fits');
  assert.equal(got.lines[0][0].id, 30);
  assert.equal(drawn.fits(got), false, 'and it is now recorded');
  assert.throws(() => drawUnique(() => card(3, [1, 2, 3, 4], [50, 51, 52, 53], [54, 55, 56, 57]), drawn, 5), /card #3: 5 draws all repeat/);
  assert.equal(DRAW_ATTEMPTS, 200);
});

test('a whole run of 699 cards from 70 songs (the study\'s pick) and from 40: no repeated card or line', () => {
  for (const pool of [70, 40]) {
    const drawn = new Drawn();
    const cards = Array.from({ length: 699 }, (_, n) => drawUnique((i) => drawFrom(pool, n + 1, (n + 1) * 1000 + i), drawn));
    assert.deepEqual(repeatedLines(cards), [], `${pool} songs`);
    assert.deepEqual(repeatedCards(cards), [], `${pool} songs`);
  }
});

test('the reports name every repeat: its songs, the first card and line, and the repeat', () => {
  const cards = [card(186, [1, 2, 3, 4], [3, 9, 45, 62], [5, 6, 7, 8]), card(398, [62, 45, 9, 3], [10, 11, 12, 13], [14, 15, 16, 17]), card(400, [8, 7, 6, 5], [4, 3, 2, 1], [3, 9, 45, 62])];
  assert.deepEqual(repeatedLines(cards).map((r) => [r.songs, r.first, r.repeat]), [
    ['3,9,45,62', '#186 line 2', '#398 line 1'],
    ['5,6,7,8', '#186 line 3', '#400 line 1'],
    ['1,2,3,4', '#186 line 1', '#400 line 2'],
    ['3,9,45,62', '#186 line 2', '#400 line 3'],
  ]);
  assert.deepEqual(repeatedCards(cards), [[186, 400]]);
});

// ---- sides: each from its pool (D101, D102, D171, D178)

/** A repertoire's song: pool 1 is 1–30, pool 2 is 31–60. */
const pooled = (id: number) => ({ id, ...(id > 30 ? { pool: '2' } : {}) });
const NORMAL_SIDES = [{ side: 1, pool: '1', label: '1–4' }, { side: 2, pool: '2', label: '5–10' }];
/** The generator's draw, simplified: the first 12 of a seeded shuffle, in 3 lines of 4. */
const lines = (songs: readonly { id: number }[], seed: string) => {
  const rnd = seededRandom([...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const ids = songs.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return [0, 1, 2].map((l) => ids.slice(l * 4, l * 4 + 4).map((id) => ({ id })));
};

test('each side is drawn from its own pool: side 1 from pool 1, side 2 from pool 2', () => {
  const songs = Array.from({ length: 60 }, (_, i) => pooled(i + 1));
  const sources = sideSources(NORMAL_SIDES, songs);
  assert.deepEqual(sources.map((s) => [s.side, s.pool, s.songs.length, s.wholeRepertoire]), [[1, '1', 30, false], [2, '2', 30, false]]);
  assert.deepEqual(sourceWarnings('normal', sources), []);
  const drawn = new DrawnByPool();
  const cards = Array.from({ length: 30 }, (_, n) => drawCard(n + 1, 'normal', sources, lines, 'seed', drawn));
  for (const card of cards) {
    assert.deepEqual(card.sides.map((s) => s.side), [1, 2]);
    assert.ok(card.sides[0].lines.flat().every((s) => s.id <= 30), `#${card.id}'s side 1 is pool 1's`);
    assert.ok(card.sides[1].lines.flat().every((s) => s.id > 30), `#${card.id}'s side 2 is pool 2's`);
  }
  const byPool = sidesByPool(cards, [{ type: 'normal', sides: NORMAL_SIDES }]);
  assert.deepEqual([...byPool.keys()], ['1', '2']);
  for (const sides of byPool.values()) {
    assert.deepEqual(repeatedLines(sides), []);
    assert.deepEqual(repeatedCards(sides), []);
  }
});

test("side 1 keeps the seed cards had before sides; side 2 has its own", () => {
  assert.equal(sideSeed('barrakudes', 12, 1, 0), 'barrakudes-12-bingo-0');
  assert.equal(sideSeed('barrakudes', 12, 2, 3), 'barrakudes-12-side2-3');
});

test("a pool with no songs is drawn from the whole repertoire, and said out loud", () => {
  const songs = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
  const sources = sideSources(NORMAL_SIDES, songs);
  assert.deepEqual(sources.map((s) => [s.side, s.songs.length, s.wholeRepertoire]), [[1, 40, false], [2, 40, true]]);
  assert.deepEqual(sourceWarnings('normal', sources), ['card type "normal", side 2: pool 2 has no songs, so this side is drawn from the whole repertoire (40 songs)']);
});

test("the songs' pools are checked: text, a pool some side is printed from, and enough songs for a side", () => {
  const types = [{ type: 'normal', sides: NORMAL_SIDES }, { type: 'especial', sides: [{ side: 1, pool: '1' }] }];
  const songs = Array.from({ length: 24 }, (_, i) => pooled(i + 1));
  assert.deepEqual(poolProblems(songs, types, 12), []);
  assert.deepEqual(poolProblems([...songs, { id: 99, pool: 3 }, { id: 98, pool: '3' }], types, 12), ['song 25: the pool must be text ("1", "2")', 'song 26: pool "3" is not one any card side is printed from (1, 2)']);
  assert.deepEqual(poolProblems([...songs.slice(0, 20), { id: 31, pool: '2' }], types, 12), ['card type "normal", side 2: pool 2 has 1 songs; a side needs 12']);
});

test('the committed cards (apps/cards/dist/cards.json): a normal card has two sides, an especial one; no card or line repeats within a pool', () => {
  const cards = JSON.parse(readFileSync(new URL('../../../cards/dist/cards.json', import.meta.url), 'utf8')) as DrawnCard<{ id: number }>[];
  const types = JSON.parse(readFileSync(new URL('../../../cards/dist/card-types.json', import.meta.url), 'utf8'));
  assert.equal(cards.length, 699);
  assert.ok(cards.every((c) => c.sides.map((s) => s.side).join() === (c.type === 'normal' ? '1,2' : '1')));
  const byPool = sidesByPool(cards, types);
  assert.deepEqual([...byPool].map(([pool, sides]) => [pool, sides.length]), [['1', 699], ['2', 399]]);
  for (const sides of byPool.values()) {
    assert.deepEqual(repeatedLines(sides), []);
    assert.deepEqual(repeatedCards(sides), []);
  }
});
