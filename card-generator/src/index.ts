import { songs } from './data/songs'
import { generateCardsJson } from './generate-cards-json'
import { generateCardsPDF } from './generate-cards-pdf'
import { saveJsonToFile } from './utils/files'

const SEED = 'barrakudes-2024-cigronet'

const cards = generateCardsJson(300, songs, SEED)
saveJsonToFile(cards, './dist/cards.json')

generateCardsPDF(cards, './dist/cards.pdf')
  .then(() => {
    // prettier-ignore
    const emojis = ['🎄','🎅','🎁','❄️','⛄','🔔','🕯️','🦌','🤶','🌟','🎶','🎵','🎉','🎊','🎈','🎂','🎇','🎆','🎑','🎀']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]
    console.log(`${emoji} Cards generated successfully!`)
  })
  .catch((error) => {
    throw error
  })
