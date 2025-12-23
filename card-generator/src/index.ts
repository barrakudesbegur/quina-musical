import { sumBy } from 'lodash';
import { generateCardsJson } from './generate-cards-json';
import { generateCardsPDF } from './generate-cards-pdf';
import songs from './songs.json';
import { saveJsonToFile } from './utils/files';

const SEED = 'barrakudes-cigronet';

const cardAmounts = [
  {
    type: 'normal',
    amount: 399, // Must be multiple of 3
  },
  {
    type: 'especial',
    amount: 300, // Must be multiple of 3
  },
] as const satisfies { type: string; amount: number }[];

const cardsByType = cardAmounts.map((cardAmount, index) => {
  const startId = sumBy(cardAmounts.slice(0, index), 'amount') + 1;
  return {
    type: cardAmount.type,
    cards: generateCardsJson(
      cardAmount.type,
      startId,
      cardAmount.amount,
      songs,
      SEED
    ),
  };
});

const allCards = cardsByType.flatMap((cardAmount) => cardAmount.cards);
saveJsonToFile(allCards, './dist/cards.json');

Promise.all(
  cardsByType.map((cardAmount) =>
    generateCardsPDF(cardAmount.cards, `./dist/cards-${cardAmount.type}.pdf`)
  )
)
  .then(() => {
    console.log('✅ Cards generated successfully!');
  })
  .catch((error) => {
    console.error('❌ Error generating cards:', error);
    throw error;
  });
