import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink,
} from '@trpc/client'
import { FC, PropsWithChildren, useState } from 'react'
import { trpc } from '../utils/trpc'

export const Providers: FC<PropsWithChildren> = ({ children }) => {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: unstable_httpSubscriptionLink({
            url: 'http://localhost:3000',
          }),
          false: unstable_httpBatchStreamLink({
            url: 'http://localhost:3000',
            fetch(url, options) {
              return fetch(url, {
                ...options,
                credentials: 'include',
              })
            },
          }),
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
