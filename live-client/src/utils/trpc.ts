import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../../live-server/src/api/index.js'

export const trpc = createTRPCReact<AppRouter>()
