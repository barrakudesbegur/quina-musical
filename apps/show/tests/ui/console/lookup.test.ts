// The Cerca tab (D162, D170): the round's songs to search, the search's results with where each song stands, and a
// card's private preview, with and without the future.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoundInfo, ShowState, SongRef } from '@quina/protocol';
import type { CatalogCard } from '../../../../../packages/ui/data/catalog.ts';
import { roundCards, roundKey } from '../../../../console/logic/future.ts';
import { peekCard, roundSongIds, searchSongs, type CardPeek, type PeekInput } from '../../../../console/logic/lookup.ts';
import { cardsInPlay } from '../../../../console/logic/possible-winners.ts';
import { forecastWins, roundSongs, type RoundSongs } from '../../../../console/logic/upcoming.ts';
import { songIndex } from '../../../../console/logic/show-data.ts';
import { S } from '../../../../console/strings.ts';

const ROUND: RoundInfo = { number: 3, kind: 'normal', startedAtMs: 1000, targetEndMs: 0, lineConfirmed: false };
const TITLES: Record<number, [string, string]> = {
  1: ['Boig per tu', 'Sau'],
  2: ['Aserejé', 'Las Ketchup'],
  3: ['Titanium', 'David Guetta, Sia'],
  4: ['Tenía Tanto Que Darte', 'Nena Daconte'],
  13: ['Dancing Queen', 'ABBA'],
};
const info = (songId: number): SongRef | null => {
  const t = TITLES[songId];
  return t ? { songId, title: t[0], artist: t[1] } : { songId, title: `Cançó ${songId}`, artist: '' };
};
/** Songs 1, 2, 3 have landed (3 on air); then this order. */
const UPCOMING = [13, 4, 14, 15, 16, 5, 6, 7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22, 23, 24];
const songsOf = (upcoming: readonly number[] | null = UPCOMING): RoundSongs =>
  roundSongs(
    { key: roundKey(ROUND), songs: new Map([[0, 1], [1, 2], [2, 3]]) },
    { round: ROUND, queue: { position: 2, length: 24 }, current: { songId: 3 } as ShowState['current'] },
    upcoming && upcoming.map((id) => info(id)!),
  );

const card = (id: number, lines: number[][], type = 'normal', sides = [1]): CatalogCard => ({ id, type, sides: sides.map((side) => ({ side, lines })) });
const PRINTED = new Map<number, CatalogCard>([
  [1, card(1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]])],
  [2, card(2, [[13, 14, 15, 16], [17, 18, 19, 20], [21, 22, 23, 24]])],
  [9, card(9, [[1, 2, 3, 13], [4, 5, 6, 7], [8, 9, 10, 11]])],
  [500, card(500, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], 'especial')],
]);
const SOLD = cardsInPlay('1-2');
const CARDS = roundCards(PRINTED, 'normal', 1);

const peek = (cardId: number, over: Partial<PeekInput> = {}): CardPeek => {
  const songs = over.songs ?? songsOf();
  const lineConfirmed = over.lineConfirmed ?? false;
  return peekCard({ printed: PRINTED, cardId, cardType: 'normal', side: 1, inPlay: SOLD, songs, lineConfirmed, forecast: forecastWins(CARDS, SOLD, songs, lineConfirmed), standing: null, ...over });
};
const ok = (p: CardPeek) => {
  assert.equal(p.status, 'ok');
  return p as Extract<CardPeek, { status: 'ok' }>;
};

test("the round's songs: the played ones, the ones to come, and every song on its cards", () => {
  const ids = roundSongIds(songsOf(null), CARDS);
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 1), 'from the cards, before the order comes');
  assert.ok(roundSongIds(songsOf([99]), []).includes(99), 'a song to come that no card has');
});

test('the search: by title or artist, typos accepted, best first, each with where it stands (never when it will play)', () => {
  const ids = roundSongIds(songsOf(), CARDS);
  const [hit] = searchSongs('tetadar', ids, info, songsOf());
  assert.equal(hit.song.title, 'Tenía Tanto Que Darte');
  assert.equal(hit.field, 'title');
  assert.deepEqual(hit.status, { state: 'ahead', ahead: 2 }, 'the panel shows it as «Encara no ha sonat»');
  const byArtist = searchSongs('nena dacon', ids, info, songsOf());
  assert.deepEqual([byArtist[0].song.songId, byArtist[0].field], [4, 'artist']);
  assert.deepEqual(searchSongs('boig', ids, info, songsOf())[0].status, { state: 'played', place: 1, ago: 2 });
  assert.deepEqual(searchSongs('titanium', ids, info, songsOf())[0].status, { state: 'now', place: 3 });
  assert.deepEqual(searchSongs('zzzz', ids, info, songsOf()), []);
  // Best first: "dancing" is Dancing Queen's whole first word; it matches nothing else here.
  assert.deepEqual(searchSongs('dancing', ids, info, songsOf()).map((h) => h.song.songId), [13]);
});

test('a card lookup: unknown numbers, cards of another round, and cards.json not loaded', () => {
  assert.deepEqual(peek(77), { status: 'unknown', cardId: 77 });
  assert.deepEqual(peek(500), { status: 'otherRound', cardId: 500, type: 'especial' }, 'an especial card in a normal round');
  assert.deepEqual(peek(500, { cardType: 'especial', side: 2 }), { status: 'otherRound', cardId: 500, type: 'especial' }, 'no side 2');
  assert.equal(ok(peek(500, { cardType: 'especial' })).cardId, 500);
  assert.deepEqual(peek(1, { printed: null }), { status: 'noCards' });
});

test('a card without the future: its songs played or not, and what it misses for a Line and the Quina', () => {
  const p = ok(peek(1));
  assert.equal(p.played, 3);
  assert.deepEqual(p.cells.slice(0, 5).map((c) => [c.songId, c.row, c.status.state]), [[1, 1, 'played'], [2, 1, 'played'], [3, 1, 'now'], [4, 1, 'ahead'], [5, 2, 'ahead']]);
  assert.deepEqual(p.line, { missing: 1, rows: [1] });
  assert.deepEqual(p.bingo, { missing: 9 });
  assert.equal(p.notSold, false);
  assert.equal(ok(peek(9)).notSold, true);
  assert.equal(ok(peek(1, { lineConfirmed: true })).line, null, 'a confirmed Line: only the Quina counts');
  assert.deepEqual(ok(peek(2)).line, { missing: 4, rows: [1, 2, 3] });
});

test('a card with the future: it can win (first Line), or it can\'t, and why', () => {
  assert.deepEqual(ok(peek(1)).chance, { canWin: true, kind: 'line', at: { n: 2, rows: [1], songId: 4 } });
  assert.deepEqual(ok(peek(2)).chance, {
    canWin: false,
    line: { missing: 4, at: 5, first: 2 },
    bingo: { at: 21, first: 13 },
  });
  // After the Line: the Quina decides (card 1 has the first one).
  assert.deepEqual(ok(peek(1, { lineConfirmed: true })).chance, { canWin: true, kind: 'bingo', at: { n: 13, rows: [], songId: 12 } });
  assert.deepEqual(ok(peek(2, { lineConfirmed: true })).chance, { canWin: false, line: null, bingo: { at: 21, first: 13 } });
  // No order yet: no verdict.
  assert.equal(ok(peek(1, { songs: songsOf(null) })).chance, null);
});

test('the Desgraciat round: standing or fallen (the engine\'s list when it has one), and when it falls', () => {
  const desgraciat = (cardId: number, cardIds: readonly number[] | null) => ok(peek(cardId, { standing: { cardIds } })).standing;
  assert.deepEqual(desgraciat(2, [2]), { fallen: false, fallsAt: { n: 1, rows: [], songId: 13 } });
  assert.deepEqual(desgraciat(1, [2]), { fallen: true, fallsAt: null });
  assert.equal(desgraciat(1, null)?.fallen, true, 'without the list: a played song sinks it');
  assert.equal(ok(peek(1, { standing: { cardIds: [2] } })).chance, null, 'no Line or Quina there');
});

test("the card's words, as the board says them", () => {
  assert.equal(S.cerca.winLine(S.cerca.rows([2]), 4, 'Tots Som Súpers'), 'La línia, a la fila 2, a +4 amb «Tots Som Súpers»: és la primera.');
  assert.equal(`${S.cerca.lostLine(1, 6, 4)} ${S.cerca.lostBingo(33, 31)}`, "Li'n falta 1, però la línia li arriba a +6 i la primera és a +4. La quina, a +33: s'acaba a +31.");
  assert.equal(S.cerca.lineMissing(1, S.cerca.rows([1])), 'Línia: en falta 1 (fila 1)');
  assert.equal(S.cerca.bingoMissing(6), 'Quina: en falten 6');
  assert.equal(S.cerca.status.played(14, 9), 'Ha sonat: la 14a, fa 9');
});

test("the lists' titles and artists: the printed cards', then the songs to come, then the snapshot's", () => {
  const catalog = { cards: new Map(), songs: new Map([[4, { id: 4, title: 'Tenia', artist: '' }], [5, { id: 5, title: 'Cinc', artist: 'X' }]]), cardTypes: null };
  const state = { current: { songId: 3, title: 'Titanium', artist: 'David Guetta' }, next: null, landings: [] } as unknown as ShowState;
  const index = songIndex(catalog, state, [{ songId: 4, title: 'Tenía Tanto Que Darte', artist: 'Nena Daconte' }]);
  assert.deepEqual(index.get(4), { songId: 4, title: 'Tenía Tanto Que Darte', artist: 'Nena Daconte' });
  assert.deepEqual(index.get(5), { songId: 5, title: 'Cinc', artist: 'X' });
  assert.equal(index.get(3)?.title, 'Titanium');
  assert.equal(songIndex(null, null, null).size, 0);
});
