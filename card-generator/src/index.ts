import { generateCardsJson } from './generate-cards-json';
import { generateCardsPDF } from './generate-cards-pdf';
import songs from './songs.json';
import { saveJsonToFile } from './utils/files';

const SEED = 'barrakudes-cigronet';

const cards = generateCardsJson(300, songs, SEED);
saveJsonToFile(cards, './dist/cards.json');

generateCardsPDF(cards, './dist/cards.pdf')
  .then(() => {
    console.log('✅ Cards generated successfully!');
  })
  .catch((error) => {
    console.error('❌ Error generating cards:', error);
    throw error;
  });
