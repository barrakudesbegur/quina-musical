import { initTRPC } from '@trpc/server'
import superjson from 'superjson'

const t = initTRPC.create({
  transformer: superjson,
  sse: {
    maxDurationMs: 3 * 60 * 60 * 1_000, // 3 hours
    ping: {
      enabled: true,
      intervalMs: 3_000,
    },
    client: {
      reconnectAfterInactivityMs: 5_000,
    },
  },
})

export const router = t.router
export const publicProcedure = t.procedure
