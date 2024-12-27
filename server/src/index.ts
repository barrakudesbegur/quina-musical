import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from './api/index.js'
import cors from 'cors'

if (!process.env.CLIENT_URL) {
  throw new Error('Environment variable "CLIENT_URL" is missing.')
}

const server = createHTTPServer({
  middleware: cors({
    origin: process.env.CLIENT_URL,
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
  router: appRouter,
  createContext() {
    return {}
  },
})

server.listen(3000)
