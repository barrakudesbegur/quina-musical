import {
  createTRPCClient,
  splitLink,
  unstable_httpBatchStreamLink,
  unstable_httpSubscriptionLink,
} from '@trpc/client'
import type { AppRouter } from '../server/api/index.js'

const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: unstable_httpSubscriptionLink({
        url: 'http://localhost:3000',
      }),
      false: unstable_httpBatchStreamLink({
        url: 'http://localhost:3000',
      }),
    }),
  ],
})

async function main() {
  const users = await trpc.user.list.query()
  console.log('Users:', users)

  const createdUser = await trpc.user.create.mutate({ name: 'sachinraja' })
  console.log('Created user:', createdUser)

  const user = await trpc.user.byId.query('1')
  console.log('User 1:', user)

  const iterable = await trpc.examples.iterable.query()

  for await (const i of iterable) {
    console.log('Iterable:', i)
  }
}

void main()
