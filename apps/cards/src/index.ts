// Generates the printed cards: cards.json (every card's sides and their songs, which the screens read),
// card-types.json (the printed types and their sides) and one PDF per type, from a repertoire's playlist (D178). Each
// side is drawn from its pool's songs (sides.ts); a pool with none is drawn from the whole repertoire, with a warning.
// The PDFs are in config.ts's CARD_LAYOUT (print/layouts.ts).
//
//   npm start -- --repertoire <name>                 write them next to the repertoire's cardsJson (default: "default")
//   npm start -- --repertoire <name> --check         check the repertoire, the types, the amounts, that the cards repeat
//                                                    no card or line, and that every song fits its cell; write nothing
//   npm start -- --repertoire <name> --layout a4-3   the same in the other layout (to proof it)
import { readFileSync, statSync } from 'fs';
import path from 'path';
import { sumBy } from 'lodash';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, CARD_LAYOUT, CARD_TYPES, SEED } from './config';
import { assertCardTypes, cardTypeProblems, printedTypeProblems } from './card-types';
import { DrawnByPool, repeatedCards, repeatedLines } from './uniqueness';
import { loadRepertoire, repertoireNameFrom, songProblems, type RepertoireSong } from './repertoire';
import { poolCounts, poolProblems, sideSources, sidesByPool, songPools, sourceWarnings } from './sides';
import { checkPrint } from './print/check';
import { CARD_LAYOUTS, layoutIdFrom } from './print/layouts';
import { saveJsonToFile } from './utils/files';

const SONGS_PER_CARD = 12;
const argv = process.argv.slice(2);
const repertoire = loadRepertoire(repertoireNameFrom(argv));
const layout = CARD_LAYOUTS[layoutIdFrom(argv, CARD_LAYOUT)];
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
];
if (problems.length) {
  console.error(`❌ Repertoire "${repertoire.name}" can't make cards:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const songs = songsJson as RepertoireSong[];
const outDir = path.dirname(repertoire.cardsJson);
const total = sumBy(CARD_AMOUNTS, 'amount');
const pools = [...poolCounts(songs)].map(([pool, n]) => `pool ${pool}: ${n}`);
const shared = songs.filter((s) => songPools(s).length > 1).length;
console.log(`Repertoire "${repertoire.name}": ${songs.length} songs (${pools.join(', ')}${shared ? `; ${shared} in several pools` : ''}) → ${total} cards (${CARD_AMOUNTS.map((a) => `${a.amount} ${a.type}`).join(', ')}), into ${path.relative(process.cwd(), outDir) || '.'}`);
// On paper: every song fits its cell, every heading its header; a missing cover is said out loud.
const print = checkPrint(layout, songs, CARD_TYPES, CARD_AMOUNTS, repertoire.coversDir);
console.log(print.summary);
for (const warning of print.warnings) console.warn(`⚠️  ${warning}`);
if (print.problems.length) {
  console.error(`❌ Can't print in layout ${layout.id}:\n- ${print.problems.join('\n- ')}`);
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
// The JSON is written (awaited) before the PDF renderer loads: it needs the native canvas module, which a --check run
// can do without, and a renderer that fails to load must not lose the JSON the screens read.
async function generate(): Promise<void> {
  await Promise.all([saveJsonToFile(allCards, repertoire.cardsJson), saveJsonToFile(CARD_TYPES, path.join(outDir, 'card-types.json'))]);
  console.log(`✅ ${path.relative(process.cwd(), repertoire.cardsJson)} and card-types.json written.`);
  const [{ generateCardsPDF }, { loadCovers }] = await Promise.all([import('./generate-cards-pdf'), import('./print/covers')]);
  const covers = layout.covers ? await loadCovers(repertoire.coversDir, songs.map((s) => s.id)) : new Map<number, string | null>();
  // One type at a time: each PDF's time and size are reported on their own.
  for (const { type, cards } of cardsByType) {
    const spec = CARD_TYPES.find((t) => t.type === type);
    if (!spec) throw new Error(`card type "${type}" is not in CARD_TYPES`);
    const outputPath = path.join(outDir, `cards-${type}.pdf`);
    const started = Date.now();
    const result = await generateCardsPDF({ type: spec, cards, layout, covers, outputPath });
    const size = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ ${path.relative(process.cwd(), outputPath)}: ${result.sheets} sheets, ${result.pages} pages, ${result.samples} samples, ${size} MB, in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  console.log('✅ Cards generated successfully!');
}
generate().catch((error) => {
  console.error('❌ Error generating cards:', error);
  process.exit(1);
});
