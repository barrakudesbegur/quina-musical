// Generates the printed cards: cards.json (every card's songs, which the screens read), card-types.json (the
// printed types) and one PDF per type, from a song pool's playlist.
//
//   npm start -- --pool <name>           write them next to the pool's cardsJson (default pool: "default")
//   npm start -- --pool <name> --check   only check the pool, the types and the amounts; write nothing
import { readFileSync } from 'fs';
import path from 'path';
import { sumBy } from 'lodash';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, CARD_TYPES, SEED } from './config';
import { assertCardTypes, cardTypeProblems } from './card-types';
import { loadPool, poolNameFrom, songProblems, type PoolSong } from './pool';
import { saveJsonToFile } from './utils/files';

const SONGS_PER_CARD = 12;
const argv = process.argv.slice(2);
const pool = loadPool(poolNameFrom(argv));
const songsJson: unknown = JSON.parse(readFileSync(pool.songsJson, 'utf-8'));

// Everything that would only show up on the night is checked before anything is written.
const problems = [
  ...songProblems(songsJson, SONGS_PER_CARD),
  ...cardTypeProblems(CARD_TYPES),
  ...CARD_AMOUNTS.filter((a) => !Number.isInteger(a.amount) || a.amount <= 0 || a.amount % 3 !== 0).map(
    (a) => `the amount of "${a.type}" cards must be a positive multiple of 3 (got ${a.amount})`,
  ),
];
if (problems.length) {
  console.error(`❌ Pool "${pool.name}" can't make cards:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const songs = songsJson as PoolSong[];
const outDir = path.dirname(pool.cardsJson);
const total = sumBy(CARD_AMOUNTS, 'amount');
console.log(`Pool "${pool.name}": ${songs.length} songs → ${total} cards (${CARD_AMOUNTS.map((a) => `${a.amount} ${a.type}`).join(', ')}), into ${path.relative(process.cwd(), outDir) || '.'}`);
if (argv.includes('--check')) {
  console.log('✅ Checked; nothing written (--check).');
  process.exit(0);
}

const cardsByType = CARD_AMOUNTS.map((cardAmount, index) => {
  const startId = sumBy(CARD_AMOUNTS.slice(0, index), 'amount') + 1;
  return { type: cardAmount.type, cards: generateCardsJson(cardAmount.type, startId, cardAmount.amount, songs, SEED) };
});

const allCards = cardsByType.flatMap((cardAmount) => cardAmount.cards);
// Before writing anything: valid type ids, and no card of a type card-types.json doesn't list.
assertCardTypes(allCards, CARD_TYPES);
saveJsonToFile(allCards, pool.cardsJson);
saveJsonToFile(CARD_TYPES, path.join(outDir, 'card-types.json'));

// The PDF renderer loads only now: it needs the native canvas module, which a --check run can do without.
import('./generate-cards-pdf')
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
