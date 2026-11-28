// Generates the printed cards: cards.json (every card's sides and their songs, which the screens read),
// card-types.json (the printed types and their sides) and one PDF per type, from a repertoire's playlist (D178). Each
// side is drawn from its pool's songs (sides.ts); a pool with none is drawn from the whole repertoire, with a warning.
// The PDFs are in config.ts's CARD_LAYOUT (print/layouts.ts): the A4 card (D295).
//
//   npm start -- --repertoire <name>                 write them next to the repertoire's cardsJson (default: "default")
//   npm start -- --repertoire <name> --check         check the repertoire, the types, the amounts, that the cards repeat
//                                                    no card or line, and that every song fits its cell; write nothing
//   npm start -- --repertoire <name> --layout a3-6   the whole run in the other layout (the A3 card with covers)
//   npm start -- --repertoire <name> --test-sheets   also the A3 test sheets (D306): cards-<type>-test-a3.pdf, each
//                                                    type's last cards (config.ts › TEST_SHEETS), the same cards
//   npm start -- --repertoire <name> --proof         only the proof for the print shop (D267): proof-<type>.pdf, the
//                                                    type's first sheet and its A3 test sheet; no JSON, no full PDFs
//   … --out <dir>                                    write into <dir> instead of the cardsJson folder
import { readFileSync, statSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { sumBy } from 'lodash';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, CARD_LAYOUT, CARD_TYPES, SEED, TEST_SHEET_LAYOUT, TEST_SHEETS } from './config';
import { assertCardTypes, cardTypeProblems, printedTypeProblems } from './card-types';
import { DrawnByPool, repeatedCards, repeatedLines } from './uniqueness';
import { loadRepertoire, outDirFrom, repertoireNameFrom, songProblems, type RepertoireSong } from './repertoire';
import { poolCounts, poolProblems, sideSources, sidesByPool, songPools, sourceWarnings } from './sides';
import { checkPrint } from './print/check';
import { CARD_LAYOUTS, layoutIdFrom } from './print/layouts';
import { sheetSlots, testSheetCards } from './print/sheets';
import { saveJsonToFile } from './utils/files';
import type { Card } from './generate-cards-json';
import type { PrintRun } from './generate-cards-pdf';
import type { PrintedCardTypeSpec } from './card-types';

const SONGS_PER_CARD = 12;
const argv = process.argv.slice(2);
const repertoire = loadRepertoire(repertoireNameFrom(argv));
const layout = CARD_LAYOUTS[layoutIdFrom(argv, CARD_LAYOUT)];
const testLayout = CARD_LAYOUTS[TEST_SHEET_LAYOUT];
const proof = argv.includes('--proof');
const withTestSheets = proof || argv.includes('--test-sheets');
const songsJson: unknown = JSON.parse(readFileSync(repertoire.songsJson, 'utf-8'));

// Everything that would only show up on the night is checked before anything is written.
const problems = [
  ...songProblems(songsJson, SONGS_PER_CARD),
  ...poolProblems(songsJson, CARD_TYPES, SONGS_PER_CARD),
  ...cardTypeProblems(CARD_TYPES),
  ...printedTypeProblems(CARD_TYPES),
  ...CARD_AMOUNTS.filter((a) => !Number.isInteger(a.amount) || a.amount <= 0).map(
    (a) => `the amount of "${a.type}" cards must be a whole number from 1 (got ${a.amount})`,
  ),
  ...TEST_SHEETS.filter((t) => !Number.isInteger(t.sheets) || t.sheets < 0 || !CARD_AMOUNTS.some((a) => a.type === t.type)).map(
    (t) => `the test sheets of "${t.type}": a type with an amount, and a whole number of sheets from 0 (got ${t.sheets})`,
  ),
];
if (problems.length) {
  console.error(`❌ Repertoire "${repertoire.name}" can't make cards:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const songs = songsJson as RepertoireSong[];
const outDir = outDirFrom(argv, path.dirname(repertoire.cardsJson), process.env.INIT_CWD ?? process.cwd());
const cardsJsonOut = path.join(outDir, path.basename(repertoire.cardsJson));
const total = sumBy(CARD_AMOUNTS, 'amount');
const pools = [...poolCounts(songs)].map(([pool, n]) => `pool ${pool}: ${n}`);
const shared = songs.filter((s) => songPools(s).length > 1).length;
console.log(`Repertoire "${repertoire.name}": ${songs.length} songs (${pools.join(', ')}${shared ? `; ${shared} in several pools` : ''}) → ${total} cards (${CARD_AMOUNTS.map((a) => `${a.amount} ${a.type}`).join(', ')}), into ${path.relative(process.cwd(), outDir) || '.'}`);
// On paper: every song fits its cell, every heading its header; a missing cover is said out loud.
const testPerSheet = testLayout.cols * testLayout.rows;
const testSheetsOf = (type: string): number => TEST_SHEETS.find((t) => t.type === type)?.sheets ?? 0;
const printChecks = [checkPrint(layout, songs, CARD_TYPES, CARD_AMOUNTS, repertoire.coversDir)];
if (withTestSheets && testLayout.id !== layout.id) {
  const testAmounts = CARD_AMOUNTS.map((a) => ({ type: a.type, amount: Math.min(a.amount, testPerSheet * testSheetsOf(a.type)) }));
  printChecks.push(checkPrint(testLayout, songs, CARD_TYPES, testAmounts.filter((a) => a.amount > 0), repertoire.coversDir));
}
for (const print of printChecks) {
  console.log(print.summary);
  for (const warning of print.warnings) console.warn(`⚠️  ${warning}`);
}
const printProblems = printChecks.flatMap((p) => p.problems);
if (printProblems.length) {
  console.error(`❌ Can't print:\n- ${printProblems.join('\n- ')}`);
  process.exit(1);
}
// Each type's sides with the songs they're drawn from; a side drawn from the whole repertoire is said out loud.
const sourcesByType = new Map(CARD_TYPES.map((t) => [t.type, sideSources(t.sides, songs)]));
for (const [type, sources] of sourcesByType) for (const warning of sourceWarnings(type, sources)) console.warn(`⚠️  ${warning}`);
// One record of what's drawn for each pool, across every type: no line is printed twice from a pool in the whole run
// (requirements › songs-and-cards).
const drawn = new DrawnByPool();
const cardsByType = CARD_AMOUNTS.map((cardAmount, index) => {
  const startId = sumBy(CARD_AMOUNTS.slice(0, index), 'amount') + 1;
  const sources = sourcesByType.get(cardAmount.type) ?? [];
  return { type: cardAmount.type, cards: generateCardsJson(cardAmount.type, startId, cardAmount.amount, sources, SEED, drawn) };
});

const allCards = cardsByType.flatMap((cardAmount) => cardAmount.cards);
// Before writing anything: valid type ids, no card of a type card-types.json doesn't list, and (checked once more on
// the finished set, pool by pool) no repeated card or line.
assertCardTypes(allCards, CARD_TYPES);
const repeats = [...sidesByPool(allCards, CARD_TYPES)].flatMap(([pool, sides]) => [
  ...repeatedLines(sides).map((r) => `pool ${pool}, line ${r.songs}: ${r.first} and ${r.repeat}`),
  ...repeatedCards(sides).map(([a, b]) => `pool ${pool}: cards #${a} and #${b}`),
]);
if (repeats.length) {
  console.error(`❌ Repeated on the cards, nothing written:\n- ${repeats.join('\n- ')}`);
  process.exit(1);
}
if (argv.includes('--check')) {
  console.log('✅ Checked, cards drawn with no repeated card or line; nothing written (--check).');
  process.exit(0);
}
/** «#394–399», or the numbers one by one when they don't run on. */
const numbers = (cards: readonly Card[]): string => {
  const ids = cards.map((c) => c.id);
  const run = ids.every((id, i) => i === 0 || id === ids[i - 1] + 1);
  return run && ids.length > 1 ? `#${ids[0]}–${ids[ids.length - 1]}` : ids.map((id) => `#${id}`).join(', ');
};
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const rel = (file: string): string => {
  const r = path.relative(process.cwd(), file);
  return r.startsWith('..') ? file : r || '.';
};
// The JSON is written (awaited) before the PDF renderer loads: it needs the native canvas module, which a --check run
// can do without, and a renderer that fails to load must not lose the JSON the screens read. A proof writes no JSON:
// its cards are the run's, and the screens' cards.json stays as it is.
async function generate(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  if (!proof) {
    await Promise.all([saveJsonToFile(allCards, cardsJsonOut), saveJsonToFile(CARD_TYPES, path.join(outDir, 'card-types.json'))]);
    console.log(`✅ ${rel(cardsJsonOut)} and card-types.json written.`);
  }
  const [{ generateCardsPDF }, { loadCovers }] = await Promise.all([import('./generate-cards-pdf'), import('./print/covers')]);
  const needsCovers = layout.covers || (withTestSheets && testLayout.covers);
  const covers = needsCovers ? await loadCovers(repertoire.coversDir, songs.map((s) => s.id)) : new Map<number, string | null>();
  // One type at a time: each PDF's time and size are reported on their own.
  const write = async (spec: PrintedCardTypeSpec, runs: PrintRun[], outputPath: string, what: string): Promise<void> => {
    const started = Date.now();
    const result = await generateCardsPDF({ type: spec, runs, covers, outputPath });
    const size = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ ${rel(outputPath)}: ${plural(result.sheets, 'sheet')}, ${plural(result.pages, 'page')}, ${plural(result.samples, 'sample')}, ${size} MB, in ${((Date.now() - started) / 1000).toFixed(1)} s${what}`);
  };
  for (const { type, cards } of cardsByType) {
    const spec = CARD_TYPES.find((t) => t.type === type);
    if (!spec) throw new Error(`card type "${type}" is not in CARD_TYPES`);
    // The test sheets (D306): the type's last cards, the same objects as its run's, as many as its TEST_SHEETS fill.
    const testCards = testSheetCards(cards, testPerSheet, testSheetsOf(type));
    const testRun: PrintRun[] = testCards.length ? [{ layout: testLayout, cards: testCards }] : [];
    const testWords = testCards.length
      ? `${testLayout.sheet.name} test ${testCards.length > testPerSheet ? 'sheets' : 'sheet'}, ${numbers(testCards)} (keep the ${layout.sheet.name} cards ${numbers(testCards)} off sale, D306)`
      : '';
    if (proof) {
      const first = sheetSlots(cards.length, layout.cols * layout.rows)[0].map((s) => cards[s.cardIndex]);
      const pages = `\n   pages 1–2: the first ${layout.sheet.name} sheet, ${first.map((c) => `#${c.id}`).join(', ')}` + (testCards.length ? `; pages 3–${2 + 2 * Math.ceil(testCards.length / testPerSheet)}: the ${testWords}` : '');
      await write(spec, [{ layout, cards, firstSheets: 1 }, ...testRun], path.join(outDir, `proof-${type}.pdf`), pages);
      continue;
    }
    await write(spec, [{ layout, cards }], path.join(outDir, `cards-${type}.pdf`), '');
    if (withTestSheets && testRun.length) await write(spec, testRun, path.join(outDir, `cards-${type}-test-${testLayout.sheet.name.toLowerCase()}.pdf`), `: the ${testWords}`);
  }
  console.log(proof ? '✅ Proof written (--proof): print each file duplex, long edge («dúplex, vora llarga»), at 100 %.' : '✅ Cards generated successfully!');
}
generate().catch((error) => {
  console.error('❌ Error generating cards:', error);
  process.exit(1);
});
