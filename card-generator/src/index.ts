import { generateQuinaCardsJson } from './generate-cards-json'
import { songs } from './data/songs'
import { generateQuinaCardsPDF } from './generate-cards-pdf'
import { saveJsonToFile } from './utils/files'

const SEED = 'barrakudes-2024-cigronet'

const quinaCards = generateQuinaCardsJson(201, songs, SEED)
saveJsonToFile(quinaCards, './dist/quinaCards.json')

generateQuinaCardsPDF(quinaCards, './dist/quinaCards.pdf')
