import songs from '../../db/default/songs.json' assert { type: 'json' }
import { publicProcedure, router } from '../trpc.js'

export const songRouter = router({
  getAll: publicProcedure.query(async () => {
    return songs
  }),
})
