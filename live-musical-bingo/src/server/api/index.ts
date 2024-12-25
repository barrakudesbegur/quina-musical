import { router } from '../trpc.js'
import { examplesRouter } from './examples.js'
import { userRouter } from './user.js'

export const appRouter = router({
  user: userRouter,
  examples: examplesRouter,
})

export type AppRouter = typeof appRouter
