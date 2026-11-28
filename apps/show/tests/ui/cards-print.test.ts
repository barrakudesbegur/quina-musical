// The 2026 printed cards (apps/cards, D250–D268): where each card and sample goes on the sheets, the duplex mirroring,
// the songs' fit (never hyphenated, measured), the two layouts' hard rules, the songs' pools (D268: a song may be in
// several), the print names (D260) and the sides' headings and Check labels (D266). Only the generator's pure parts:
// the fonts are measured with made-up widths here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printPages, sampleCount, sheetSlots, sideRows, testSheetCardIndexes, testSheetCards } from '../../../cards/src/print/sheets.ts';
import { fitSong, lineCount, TITLE_MIN, type SongMeasures } from '../../../cards/src/print/fit.ts';
import { CARD_LAYOUTS, CARD_LAYOUT_IDS, HEADING_SIZE, QR_SIZE, cardGeometry, headingProblems, layoutIdFrom } from '../../../cards/src/print/layouts.ts';
import { inPool, poolCounts, poolProblems, sideSources, songPools } from '../../../cards/src/sides.ts';
import { cardTypeProblems, printedTypeProblems } from '../../../cards/src/card-types.ts';
import { CARD_AMOUNTS, CARD_LAYOUT, CARD_TITLE, CARD_TYPES, PRINT_PAPER, TEST_SHEET_LAYOUT, TEST_SHEETS, cardUrl } from '../../../cards/src/config.ts';
import { proofFiles } from '../../../cards/src/print/proof.ts';
import { outDirFrom, parseRepertoire, printName, songProblems } from '../../../cards/src/repertoire.ts';

// ---- the sheets: page order, samples, duplex

const ids = (sheet: { cardIndex: number; sample: boolean }[]) => sheet.map((s) => (s.sample ? `s${s.cardIndex + 1}` : String(s.cardIndex + 1)));

test('sheet p holds cards p, p + sheets, p + 2 × sheets…: each cut stack runs in number order', () => {
  const sheets = sheetSlots(12, 6);
  assert.deepEqual(sheets.map(ids), [['1', '3', '5', '7', '9', '11'], ['2', '4', '6', '8', '10', '12']]);
  assert.equal(sampleCount(sheets), 0);
});

test("the empty places hold samples, in page order: copies of the type's last cards (399 normal cards, 6 a sheet)", () => {
  const sheets = sheetSlots(399, 6);
  assert.equal(sheets.length, 67);
  assert.equal(sampleCount(sheets), 3);
  assert.ok(sheets.every((s) => s.length === 6), 'every place is filled');
  const samples = sheets.flatMap((sheet, p) => sheet.flatMap((slot, k) => (slot.sample ? [[p + 1, k + 1, slot.cardIndex + 1]] : [])));
  assert.deepEqual(samples, [[65, 6, 397], [66, 6, 398], [67, 6, 399]], '#397, #398, #399 on the last three sheets');
  // Every real card exactly once.
  const real = sheets.flat().filter((s) => !s.sample).map((s) => s.cardIndex).sort((a, b) => a - b);
  assert.deepEqual(real, Array.from({ length: 399 }, (_, i) => i));
  // The especial cards fill whole sheets; option B's 3 a sheet too.
  assert.equal(sampleCount(sheetSlots(300, 6)), 0);
  assert.equal(sampleCount(sheetSlots(399, 3)), 0);
});

test('more empty places than cards: the samples go round the cards again; no cards, no sheets', () => {
  assert.deepEqual(sheetSlots(2, 6).map(ids), [['1', '2', 's1', 's2', 's1', 's2']]);
  assert.deepEqual(sheetSlots(0, 6), []);
  assert.throws(() => sheetSlots(5, 0), /places a sheet/);
  assert.throws(() => sheetSlots(-1, 6), /amount/);
});

test('the A4 card is the default (D295): both amounts fill whole A4 sheets, 133 + 100, so no samples', () => {
  assert.equal(CARD_LAYOUT, 'a4-3');
  const perSheet = CARD_LAYOUTS[CARD_LAYOUT].cols * CARD_LAYOUTS[CARD_LAYOUT].rows;
  assert.deepEqual(CARD_AMOUNTS.map((a) => sheetSlots(a.amount, perSheet).length), [133, 100]);
  assert.deepEqual(CARD_AMOUNTS.map((a) => sampleCount(sheetSlots(a.amount, perSheet))), [0, 0]);
  // The A3 layout still prints a whole run, with its own samples (#397–399 on the normal run's last sheets).
  assert.equal(sampleCount(sheetSlots(399, 6)), 3);
});

/** Each type's cards as a run numbers them: normal 1–399, then especial 400–699. */
const runCards = () => {
  let next = 1;
  return CARD_AMOUNTS.map((a) => {
    const cards = Array.from({ length: a.amount }, (_, i) => ({ id: next + i, type: a.type }));
    next += a.amount;
    return { type: a.type, cards };
  });
};

test("the A3 test sheets (D306) repeat each type's last cards: normal #394–399, especial #694–699, one sheet each", () => {
  assert.equal(TEST_SHEET_LAYOUT, 'a3-6');
  const test = CARD_LAYOUTS[TEST_SHEET_LAYOUT];
  assert.equal(test.covers, true, 'the square card with covers');
  const perSheet = test.cols * test.rows;
  assert.deepEqual(TEST_SHEETS.map((t) => [t.type, t.sheets]), [['normal', 1], ['especial', 1]]);
  const numbers = runCards().map(({ type, cards }) => testSheetCards(cards, perSheet, TEST_SHEETS.find((t) => t.type === type)?.sheets ?? 0).map((c) => c.id));
  assert.deepEqual(numbers, [[394, 395, 396, 397, 398, 399], [694, 695, 696, 697, 698, 699]]);
  // One sheet each, in number order, no sample: every place is one of those cards.
  for (const ids of numbers) {
    const sheets = sheetSlots(ids.length, perSheet);
    assert.equal(sheets.length, 1);
    assert.equal(sampleCount(sheets), 0);
    assert.deepEqual(sheets[0].map((s) => ids[s.cardIndex]), ids);
  }
});

test("the test sheets' cards are the A4 run's own cards: the same numbers, songs and QR", () => {
  const songs = (id: number) => [{ side: 1, lines: [[{ id: id % 70, title: `t${id}`, artist: 'a' }]] }];
  const cards = Array.from({ length: 399 }, (_, i) => ({ id: i + 1, type: 'normal', sides: songs(i + 1) }));
  const test = testSheetCards(cards, 6, 1);
  assert.deepEqual(test.map((c) => c.id), [394, 395, 396, 397, 398, 399]);
  test.forEach((card, i) => {
    assert.equal(card, cards[393 + i], 'the very card object, songs and all');
    assert.equal(cardUrl(card.id), `https://quina.barrakudesbegur.org/26/${394 + i}`, 'the QR encodes its number, as on the A4 card');
  });
  // Two sheets take the last 12; more sheets than cards take them all; none, nothing.
  assert.deepEqual(testSheetCardIndexes(399, 6, 2), Array.from({ length: 12 }, (_, i) => 387 + i));
  assert.deepEqual(testSheetCardIndexes(4, 6, 1), [0, 1, 2, 3]);
  assert.deepEqual(testSheetCards(cards, 6, 0), []);
  assert.throws(() => testSheetCardIndexes(399, 6, 1.5), /test sheets/);
  assert.throws(() => testSheetCardIndexes(399, 0, 1), /places a sheet/);
});

test('--out writes a run elsewhere (the proof), relative to where the command ran; else the cardsJson folder', () => {
  assert.equal(outDirFrom([], '/repo/data/media/2026/cards', '/repo/apps/cards'), '/repo/data/media/2026/cards');
  assert.equal(outDirFrom(['--proof', '--out', '../../temp/proof'], '/x', '/repo/apps/cards'), '/repo/temp/proof');
  assert.equal(outDirFrom(['--out=/tmp/p'], '/x', '/repo'), '/tmp/p');
  assert.throws(() => outDirFrom(['--out'], '/x', '/repo'), /--out needs a folder/);
  assert.throws(() => outDirFrom(['--out', '--proof'], '/x', '/repo'), /--out needs a folder/);
});

test("a back page's rows are mirrored, so each card's side 2 is printed behind its side 1 (long-edge duplex)", () => {
  const places = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(sideRows(places, 2, 1), [['a', 'b'], ['c', 'd'], ['e', 'f']]);
  assert.deepEqual(sideRows(places, 2, 2), [['b', 'a'], ['d', 'c'], ['f', 'e']]);
  assert.deepEqual(sideRows(['a', 'b', 'c'], 1, 2), [['a'], ['b'], ['c']], 'one column: nothing to mirror');
  assert.deepEqual(places, ['a', 'b', 'c', 'd', 'e', 'f'], 'the sheet itself is left as it was');
  assert.deepEqual(printPages(['s1', 's2'], [1, 2]).map((p) => `${p.sheet}/${p.side}`), ['s1/1', 's1/2', 's2/1', 's2/2'], 'side 1, then side 2 of the same sheet');
});

// ---- the songs' fit

/** Every character is half the font size wide (letter spacing included); a space too. */
const HALF: SongMeasures = { title: (t, s) => t.length * s * 0.5, artist: (t, s) => t.length * s * 0.5 };

test('lines wrap at word breaks; a word wider than the box would be split, so it is refused', () => {
  assert.equal(lineCount('AB CD', HALF.title, 10, 25), 1, '5 characters at 5 pt');
  assert.equal(lineCount('AB CD', HALF.title, 10, 20), 2);
  assert.equal(lineCount('ABCDEFGH', HALF.title, 10, 20), null);
  assert.equal(lineCount('AB  CD', HALF.title, 10, 25), 1, 'a double space is one break');
});

test('a song gets the largest title that fits (up to 3 lines), then the largest artist (up to 2, 8 pt or more first)', () => {
  const box = { width: 100, height: 60 };
  const short = fitSong({ title: 'Dura', artist: 'Daddy Yankee' }, box, 16, HALF);
  assert.deepEqual([short.fits, short.titleSize, short.titleLines, short.artistSize], [true, 16, 1, 12]);
  // A long title steps down until it is 3 lines at most and the lines fit the height.
  const long = fitSong({ title: 'Busco un centro de gravedad permanente', artist: 'Rigoberta Bandini' }, box, 16, HALF);
  assert.ok(long.fits && long.titleSize < 16 && long.titleLines <= 3 && long.artistLines <= 2, JSON.stringify(long));
  assert.ok(long.artistSize >= 8, 'the artist stays readable');
  // The title is measured in capitals, as printed.
  const upper: SongMeasures = { title: (t, s) => (t === t.toUpperCase() ? t.length * s * 0.5 : 0), artist: HALF.artist };
  assert.equal(fitSong({ title: 'abc', artist: 'x' }, box, 16, upper).titleSize, 16);
});

test("a song that can't fit at 7 pt is reported as not fitting (the check stops the run)", () => {
  const none = fitSong({ title: 'Supercalifragilisticexpialidocious', artist: 'A' }, { width: 40, height: 60 }, 16, HALF);
  assert.deepEqual([none.fits, none.titleSize], [false, TITLE_MIN]);
  // Nothing fits with the artist at 8 pt or more: smaller artists are tried before giving up.
  // An artist's one word 20 characters long: 80 pt wide at 8 pt, 70 pt at 7 pt.
  const tight = fitSong({ title: 'AB', artist: 'Abcdefghijklmnopqrst' }, { width: 70, height: 40 }, 16, HALF);
  assert.ok(tight.fits && tight.artistSize < 8, JSON.stringify(tight));
});

// ---- the layouts

test("both layouts keep the hard rules: a 45 pt QR, 38 pt headings, the A3 · 6 and A4 · 3 card sizes", () => {
  assert.equal(QR_SIZE, 45, 'never smaller than 16 mm');
  assert.equal(HEADING_SIZE, 38);
  assert.equal(CARD_LAYOUT, 'a4-3', "the organizers' pick (D295)");
  const mm = (pt: number) => Math.round((pt / 72) * 25.4 * 10) / 10;
  const a = cardGeometry(CARD_LAYOUTS['a3-6']);
  assert.deepEqual([mm(a.card.width), mm(a.card.height)], [148.5, 140]);
  assert.equal(a.cell.kind, 'coverAbove');
  assert.equal(a.cell.kind === 'coverAbove' && mm(a.cell.cover), 17, 'covers 17 mm on the square card (the user, 28 Nov)');
  const b = cardGeometry(CARD_LAYOUTS['a4-3']);
  assert.deepEqual([mm(b.card.width), mm(b.card.height)], [210, 99]);
  assert.equal(b.cell.kind, 'textOnly');
  for (const id of CARD_LAYOUT_IDS) {
    const g = cardGeometry(CARD_LAYOUTS[id]);
    assert.ok(g.cell.textBox.width > 0 && g.cell.textBox.height > 0, id);
    assert.ok(g.header.height >= QR_SIZE, `${id}: the QR fits its header`);
  }
});

test('a heading too wide for its header at 38 pt is a problem (it never shrinks); side 2 counts its black box', () => {
  const g = cardGeometry(CARD_LAYOUTS['a3-6']);
  const width = (text: string, size: number) => text.length * size * 0.4;
  assert.deepEqual(headingProblems(g, [{ text: 'QUINES 1–5', side: 1 }, { text: 'ESPECIAL', side: 2 }], width), []);
  const wide = 'X'.repeat(Math.ceil(g.headingRoom / (HEADING_SIZE * 0.4)) + 1);
  assert.match(headingProblems(g, [{ text: wide, side: 1 }], width).join(), /doesn't fit its header at 38 pt/);
  const justFits = 'X'.repeat(Math.floor(g.headingRoom / (HEADING_SIZE * 0.4)));
  assert.deepEqual(headingProblems(g, [{ text: justFits, side: 1 }], width), []);
  const almost = () => g.headingRoom - 1;
  assert.deepEqual(headingProblems(g, [{ text: 'X', side: 1 }], almost), [], 'bare, it fits');
  assert.equal(headingProblems(g, [{ text: 'X', side: 2 }], almost).length, 1, 'in its black box, the padding tips it over');
});

test('--layout prints a whole run in the other layout; anything else is refused', () => {
  assert.equal(layoutIdFrom([], 'a3-6'), 'a3-6');
  assert.equal(layoutIdFrom(['--layout', 'a4-3'], 'a3-6'), 'a4-3');
  assert.equal(layoutIdFrom(['--check', '--layout=a4-3'], 'a3-6'), 'a4-3');
  assert.throws(() => layoutIdFrom(['--layout', 'a5'], 'a3-6'), /--layout needs one of a3-6, a4-3/);
});

// ---- pools (D268): a song may be in several

test("a song's pools: pools, else its one pool, else pool 1; pools wins when it has both", () => {
  assert.deepEqual(songPools({ id: 1 }), ['1']);
  assert.deepEqual(songPools({ id: 1, pool: '2' }), ['2']);
  assert.deepEqual(songPools({ id: 1, pools: ['1', '2'] }), ['1', '2']);
  assert.deepEqual(songPools({ id: 1, pool: '1', pools: ['1', '2'] }), ['1', '2']);
  assert.ok(inPool({ id: 1, pools: ['1', '2'] }, '2'));
  assert.ok(!inPool({ id: 1, pool: '2' }, '1'));
  assert.deepEqual([...poolCounts([{ id: 1, pools: ['1', '2'] }, { id: 2 }, { id: 3, pool: '2' }])], [['1', 2], ['2', 2]]);
});

test('each side is drawn from the songs in its pool, a song in both pools on either side', () => {
  const songs = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, pools: i < 10 ? ['1'] : i < 20 ? ['1', '2'] : ['2'] }));
  const sources = sideSources([{ side: 1, pool: '1' }, { side: 2, pool: '2' }], songs);
  assert.deepEqual(sources.map((s) => [s.side, s.songs.length, s.wholeRepertoire]), [[1, 20, false], [2, 20, false]]);
  assert.deepEqual(sources[0].songs.map((s) => s.id).filter((id) => sources[1].songs.some((s) => s.id === id)).length, 10, 'songs 11–20 on both');
});

test("the songs' pools are checked: a list of distinct ids, its pool in it, pools some side prints, and each counted per pool", () => {
  const types = [{ type: 'normal', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] }];
  const songs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, pools: ['1', '2'] }));
  assert.deepEqual(poolProblems(songs, types, 12), [], '12 songs in both pools fill both sides');
  assert.deepEqual(poolProblems([...songs, { id: 13, pools: [] }, { id: 14, pools: '1' }, { id: 15, pools: [1] }], types, 12), [
    'song 13: the pools must be a list of pool ids (["1", "2"])',
    'song 14: the pools must be a list of pool ids (["1", "2"])',
    'song 15: the pools must be a list of pool ids (["1", "2"])',
  ]);
  assert.deepEqual(poolProblems([...songs, { id: 13, pools: ['1', '1'] }, { id: 14, pool: '2', pools: ['1'] }, { id: 15, pools: ['1', '3'] }], types, 12), [
    'song 13: a pool is listed twice in its pools (1, 1)',
    'song 14: its pool "2" is not in its pools (1)',
    'song 15: pool "3" is not one any card side is printed from (1, 2)',
  ]);
  assert.deepEqual(poolProblems([...songs.slice(0, 11).map((s) => ({ ...s, pools: ['1'] })), { id: 12, pools: ['1', '2'] }], types, 12), [
    'card type "normal", side 2: pool 2 has 1 songs; a side needs 12',
  ]);
});

// ---- print names (D260) and the repertoire's covers

test('a song prints (and cards.json carries) its print name where it has one', () => {
  assert.deepEqual(printName({ title: 'Dura - Remix', artist: 'Daddy Yankee, Bad Bunny', printTitle: 'Dura', printArtist: 'Daddy Yankee' }), { title: 'Dura', artist: 'Daddy Yankee' });
  assert.deepEqual(printName({ title: 'Mamma Mia', artist: 'ABBA' }), { title: 'Mamma Mia', artist: 'ABBA' });
  const song = { id: 1, title: 'A', artist: 'B', cover: '', spotifyId: '' };
  assert.deepEqual(songProblems([song, { ...song, id: 2, printTitle: ' ' }, { ...song, id: 3, printArtist: 4 }], 3), [
    'song 2: the printTitle must be text, or left out',
    'song 3: the printArtist must be text, or left out',
  ]);
});

test("a repertoire's coversDir is made absolute like its other paths, and left out when it has none", () => {
  const r = parseRepertoire('x', { songsJson: 's.json', cardsJson: 'c/cards.json', coversDir: 'data/media/x/covers' }, '/repo');
  assert.equal(r.coversDir, '/repo/data/media/x/covers');
  assert.equal('coversDir' in parseRepertoire('x', { songsJson: 's.json', cardsJson: 'c.json' }, '/repo'), false);
  assert.throws(() => parseRepertoire('x', { songsJson: 's.json', cardsJson: 'c.json', coversDir: 3 }, '/repo'), /"coversDir" must be a path/);
});

// ---- the printed types: headings and Check labels (D252, D266)

test("every printed side has its heading and its Check label; the title has no «3» (D254)", () => {
  assert.deepEqual(cardTypeProblems(CARD_TYPES), []);
  assert.deepEqual(printedTypeProblems(CARD_TYPES), []);
  assert.deepEqual(CARD_TYPES.map((t) => t.sides.map((s) => [s.heading, s.checkLabel])), [
    [['QUINES 1–5', 'Normal 1–5'], ['QUINES 6–10', 'Normal 6–10']],
    [['DESGRACIAT', 'Desgraciat'], ['ESPECIAL', 'Especial']],
  ]);
  assert.equal(CARD_TITLE, 'QUINA QUINA!');
  assert.deepEqual(CARD_AMOUNTS.map((a) => a.amount), [399, 300], 'normal 1–399, especial 400–699');
});

test('a Check label or heading, when given, must be text; the generator requires both on every side', () => {
  const type = { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: '', priceCents: 150, sides: [{ side: 1, pool: '1' }] };
  assert.deepEqual(cardTypeProblems([type]), [], 'a card-types.json from before them is still valid');
  assert.deepEqual(cardTypeProblems([{ ...type, sides: [{ side: 1, pool: '1', checkLabel: ' ' }] }]), ['card type "normal", side 1: the checkLabel must be text, or left out']);
  assert.deepEqual(printedTypeProblems([type]), ['card type "normal", side 1: no checkLabel', 'card type "normal", side 1: no heading']);
});

test('the proof (D267) is one file per type and paper size, each saying how the shop prints it', () => {
  const a4 = CARD_LAYOUTS[CARD_LAYOUT];
  const a3 = CARD_LAYOUTS[TEST_SHEET_LAYOUT];
  assert.deepEqual(PRINT_PAPER, { normal: 'blue', especial: 'pink' });
  const parts = [
    { layout: a4, what: 'the first A4 sheet', sheets: 1, run: 'a4' },
    { layout: a3, what: 'the A3 test sheet', sheets: 1, run: 'a3' },
  ];
  const files = proofFiles('especial', PRINT_PAPER.especial, parts);
  assert.deepEqual(files.map((f) => [f.file, f.sheet, f.parts.map((p) => p.run)]), [['proof-especial-a4.pdf', 'A4', ['a4']], ['proof-especial-a3.pdf', 'A3', ['a3']]]);
  assert.equal(files[0].print, 'A4, pink paper, black and white, duplex long edge («dúplex, vora llarga»), at 100 %');
  assert.equal(files[1].print, 'A3, pink paper, colour, duplex long edge («dúplex, vora llarga»), at 100 %');
  // A whole run in the A3 layout (--layout a3-6): one paper size, so one file.
  assert.deepEqual(proofFiles('normal', 'blue', [{ ...parts[0], layout: a3 }, parts[1]]).map((f) => [f.file, f.parts.length]), [['proof-normal-a3.pdf', 2]]);
});
