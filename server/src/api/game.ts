import { publicProcedure, router } from '../trpc.js'
import songs from '../../db/default/songs.json' with { type: 'json' }

const shuffledSongs = songs.sort(() => Math.random() - 0.5)

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: 'ongoing' as 'not-started' | 'ongoing' | 'paused' | 'finished',
    }
  }),
  // TODO: This is fake data
  playedSongs: publicProcedure.query(async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const count = Math.floor((nowSeconds / 5) % shuffledSongs.length)
    return shuffledSongs
      .slice(0, count)
      .map((song, index) => ({
        ...song,
        position: index + 1,
      }))
      .toReversed()
  }),
})
