import { publicProcedure, router } from '../trpc.js'

export const examplesRouter = router({
  iterable: publicProcedure.query(async function* () {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      yield i
    }
  }),
})
