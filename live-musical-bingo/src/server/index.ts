import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from './api/index.js'

const server = createHTTPServer({
  router: appRouter,
})

server.listen(3000)
