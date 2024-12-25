import { router } from '../trpc.js'
import { songRouter } from './song.js'

export const appRouter = router({
  song: songRouter,
})

export type AppRouter = typeof appRouter
