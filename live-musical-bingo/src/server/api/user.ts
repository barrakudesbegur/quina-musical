import { z } from 'zod'
import { db } from '../db.js'
import { publicProcedure, router } from '../trpc.js'

export const userRouter = router({
  list: publicProcedure.query(async () => {
    const users = await db.user.findMany()
    return users
  }),
  byId: publicProcedure.input(z.string()).query(async (opts) => {
    const { input } = opts
    const user = await db.user.findById(input)
    return user
  }),
  create: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts
      const user = await db.user.create(input)
      return user
    }),
})
