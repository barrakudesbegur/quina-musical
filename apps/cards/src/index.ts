// Generates the printed cards: cards.json (every card's songs, which the screens read), card-types.json (the
// printed types) and one PDF per type, from a repertoire's playlist (D178).
//
//   npm start -- --repertoire <name>           write them next to the repertoire's cardsJson (default: "default")
//   npm start -- --repertoire <name> --check   check the repertoire, the types, the amounts and that the cards repeat no card or
//                                        line; write nothing
import { readFileSync } from 'fs';
import path from 'path';
import { sumBy } from 'lodash';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, CARD_TYPES, SEED } from './config';
import { assertCardTypes, cardTypeProblems } from './card-types';
import { Drawn, repeatedCards, repeatedLines } from './uniqueness';
import { loadRepertoire, repertoireNameFrom, songProblems, type RepertoireSong } from './repertoire';
import { saveJsonToFile } from './utils/files';

const SONGS_PER_CARD = 12;
const argv = process.argv.slice(2);
const repertoire = loadRepertoire(repertoireNameFrom(argv));
const songsJson: unknown = JSON.parse(readFileSync(repertoire.songsJson, 'utf-8'));

// Everything that would only show up on the night is checked before anything is written.
const problems = [
  ...songProblems(songsJson, SONGS_PER_CARD),
  ...cardTypeProblems(CARD_TYPES),
  ...CARD_AMOUNTS.filter((a) => !Number.isInteger(a.amount) || a.amount <= 0 || a.amount % 3 !== 0).map(
    (a) => `the amount of "${a.type}" cards must be a positive multiple of 3 (got ${a.amount})`,
  ),
];
if (problems.length) {
  console.error(`❌ Repertoire "${repertoire.name}" can't make cards:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const songs = songsJson as RepertoireSong[];
const outDir = path.dirname(repertoire.cardsJson);
const total = sumBy(CARD_AMOUNTS, 'amount');
console.log(`Repertoire "${repertoire.name}": ${songs.length} songs → ${total} cards (${CARD_AMOUNTS.map((a) => `${a.amount} ${a.type}`).join(', ')}), into ${path.relative(process.cwd(), outDir) || '.'}`);
// One record of what's drawn for every type: no line is printed twice in the whole run (requirements › songs-and-cards).
const drawn = new Drawn();
const cardsByType = CARD_AMOUNTS.map((cardAmount, index) => {
  const startId = sumBy(CARD_AMOUNTS.slice(0, index), 'amount') + 1;
  return { type: cardAmount.type, cards: generateCardsJson(cardAmount.type, startId, cardAmount.amount, songs, SEED, drawn) };
});

const allCards = cardsByType.flatMap((cardAmount) => cardAmount.cards);
// Before writing anything: valid type ids, no card of a type card-types.json doesn't list, and (checked once more on
// the finished set) no repeated card or line.
assertCardTypes(allCards, CARD_TYPES);
const repeats = [...repeatedLines(allCards).map((r) => `line ${r.songs}: ${r.first} and ${r.repeat}`), ...repeatedCards(allCards).map(([a, b]) => `cards #${a} and #${b}`)];
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
Promise.all([saveJsonToFile(allCards, repertoire.cardsJson), saveJsonToFile(CARD_TYPES, path.join(outDir, 'card-types.json'))])
  .then(() => console.log(`✅ ${path.relative(process.cwd(), repertoire.cardsJson)} and card-types.json written.`))
  .then(() => import('./generate-cards-pdf'))
  .then(({ generateCardsPDF }) =>
    Promise.all(cardsByType.map((cardAmount) => generateCardsPDF(cardAmount.cards, path.join(outDir, `cards-${cardAmount.type}.pdf`)))),
  )
  .then(() => {
    console.log('✅ Cards generated successfully!');
  })
  .catch((error) => {
    console.error('❌ Error generating cards:', error);
    throw error;
  });
