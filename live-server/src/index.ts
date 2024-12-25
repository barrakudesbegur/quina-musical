import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from './api/index.js'
import cors from 'cors'

const server = createHTTPServer({
  middleware: cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
  router: appRouter,
  createContext() {
    return {}
  },
})

server.listen(3000)
