# Realtime

In last tutorial we learned how to add subscriptions using Server Sent events as transport layer. GraphQL subscriptions are long-lived requests. Client can subscribe to streams of data as the events happen.

While Subscriptions are part of GraphQL specification. Another way to add realtime functionality to your application is using Live Queries. The major difference between Subscriptions and Live queries is that in Subscriptions clients will subscribe to the stream of data and as events happen they data is pushed out to clients. Whereas with live queries clients will issue a regular query and as the data in query will be updated. In simple terms when we have Live query we are observing data. Checkout this [blog post explaining Live Queries and Subscriptions](https://the-guild.dev/blog/subscriptions-and-live-queries-real-time-with-graphql) in detail.

Let's add live queries to our server implementation.

```shell
npm install @n1ru4l/in-memory-live-query-store @envelop/live-query
```

Now let's add envelop plugin that will make it easy to drop in live queries.

```ts
// context.ts
import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store'
import { PrismaClient, User } from '@prisma/client'
import { FastifyRequest } from 'fastify'
import { pubSub } from './pubsub'

const prisma = new PrismaClient()
export const liveQueryStore = new InMemoryLiveQueryStore()

export type GraphQLContext = {
  prisma: PrismaClient
  currentUser: User | null
  pubSub: typeof pubSub
  liveQueryStore: InMemoryLiveQueryStore
}

export async function contextFactory(
  request: FastifyRequest,
  // Current user is injected by auth plugin
): Promise<Omit<GraphQLContext, 'currentUser'>> {
  return {
    prisma,
    pubSub,
    liveQueryStore,
  }
}

// ----------------------------------------------------------------------------
// index.ts

import { contextFactory as gqlContext, liveQueryStore } from './context'
import { useLiveQuery } from '@envelop/live-query'

const getEnvelop = envelop({
  plugins: [
    useSchema(schema),
    useExtendContext((ctx) => gqlContext(ctx.request)),
    useLogger(),
    useGenericAuth({
      resolveUserFn: authenticateUser,
      mode: 'protect-all',
    }),
    useLiveQuery({ liveQueryStore }),
    enableIf(process.env.NODE_ENV === 'production', disableIntrospection()),
  ],
})
```

Now add `@live` directive to schema.

```graphql
directive @live on QUERY
```

Now let's update our mutation resolvers to invalidate the feed query `context.liveQueryStore.invalidate('Query.feed')` each time a new post is added or vote is updated. This will make help push updated data to the client.
