import { publicProcedure, router } from '../trpc.js'
import songs from '../../db/default/songs.json' with { type: 'json' }

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: 'ongoing' as 'not-started' | 'ongoing' | 'paused' | 'finished',
    }
  }),
  getState: publicProcedure.query(async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    // const count = Math.floor((nowSeconds / 2) % songs.length)
    const count = 50
    const playedSongs = songs
      .slice(0, count)
      .map((song, index) => ({
        ...song,
        position: index + 1,
      }))
      // Sort in descending order
      .sort((a, b) => b.position - a.position)

    return {
      round: {
        name: '12',
        position: 12,
      },
      playedSongs,
    }
  }),
  getAllSongs: publicProcedure.query(async () => {
    return songs.slice().sort((a, b) => a.title.localeCompare(b.title))
  }),
})
