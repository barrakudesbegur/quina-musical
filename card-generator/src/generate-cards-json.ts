import type { Song } from './data/songs'
import { shuffleArrayWithSeed } from './utils/arrays'

export type QuinaCard = {
  id: string
  lines: [
    [Song, Song, Song, Song],
    [Song, Song, Song, Song],
    [Song, Song, Song, Song],
  ]
}

function makeQuinaCard(id: string, allSongs: Song[], seed: string) {
  if (allSongs.length < 12) {
    throw new Error(
      'Not enough songs to generate a card - need at least 12 songs'
    )
  }

  const shuffledSongs = shuffleArrayWithSeed(allSongs, seed)

  const quinaCard: QuinaCard = {
    id: id,
    lines: [
      shuffledSongs.slice(0, 4),
      shuffledSongs.slice(4, 8),
      shuffledSongs.slice(8, 12),
    ] as QuinaCard['lines'],
  }

  return quinaCard
}

export function generateQuinaCardsJson(
  amount: number,
  songs: Song[],
  seed: string
) {
  return Array.from({ length: amount }, (_, i) => {
    const id = (i + 1).toLocaleString()
    return makeQuinaCard(id, songs, `${seed}-${id}`)
  })
}
