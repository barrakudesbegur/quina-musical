import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink,
} from '@trpc/client';
import { FC, PropsWithChildren, useState } from 'react';
import superjson from 'superjson';
import { WiiMoteProvider } from '../contexts/WiiMoteContext';
import { trpc } from '../utils/trpc';

if (!import.meta.env.VITE_API_URL) {
  throw new Error('Environment variable "VITE_API_URL" is missing.');
}

export const Providers: FC<PropsWithChildren> = ({ children }) => {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: unstable_httpSubscriptionLink({
            url: import.meta.env.VITE_API_URL,
            transformer: superjson,
            eventSourceOptions() {
              return {
                withCredentials: true,
              };
            },
          }),
          false: unstable_httpBatchStreamLink({
            url: import.meta.env.VITE_API_URL,
            transformer: superjson,
            fetch(url, options) {
              return fetch(url, {
                ...options,
                credentials: 'include',
              });
            },
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HeroUIProvider>
          <WiiMoteProvider>{children}</WiiMoteProvider>
        </HeroUIProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};
