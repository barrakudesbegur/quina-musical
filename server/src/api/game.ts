import { publicProcedure, router } from '../trpc.js'

export const gameRouter = router({
  getStatus: publicProcedure.query(async () => {
    return {
      status: 'ongoing' as 'not-started' | 'ongoing' | 'paused' | 'finished',
    }
  }),
})
