# Simplifying our Auth setup

We have a simple token based solution for authentication. User will login and get a token. Which then is passed as a `Bearer TOKEN` to the API and used to verify the user on each request and inject the logged in user to the context. If we want to protect a resolver we just need to check the user is in the context.

What if we want to protect all resolvers by default and only allow specific resolvers to be accessed? What if we could just mark fields on our schema to tell us which are publicly accessible?

#### Introducing GraphQL Directives:

Directives provide a way to alternate runtime execution and type validation. They can be used to add additional validation on runtime to alter behaviour of a field.

Thanks to envelop's vast plugin ecosystem it makes it very simple to implement custom auth flow and provide a GraphQL Directive which can be used to mark fields public.

Let's install [`generic-auth`](https://www.envelop.dev/plugins/use-generic-auth#envelopgeneric-auth) plugin

```bash
npm install @envelop/generic-auth
```

Let's start by customizing our existing `authenticateUser` function. We will use it to have the same signature as the `ResolveUserFn` from the `@envelop/generic-auth` plugin. Earlier we were using this to check the request object and then return the User object. Now we will modify it to use the context built so far, validate the token and return the user.

```ts
import { User } from '@prisma/client'
import { JwtPayload, verify } from 'jsonwebtoken'
import { ResolveUserFn } from '@envelop/generic-auth'

export const APP_SECRET = 'this is my secret'

export const authenticateUser: ResolveUserFn<User> = async (context) => {
  if (context?.req?.headers?.authorization) {
    const token = context.req.headers.authorization.split(' ')[1]
    const tokenPayload = verify(token, APP_SECRET) as JwtPayload
    const userId = tokenPayload.userId

    return await context.prisma.user.findUnique({ where: { id: userId } })
  }

  return null
}
```

Let's remove the `currentUser` from our `GraphQLContext` since it will be handled by the `@envelop/generic-auth` plugin.

```ts
import { PrismaClient, User } from '@prisma/client'
import { FastifyRequest } from 'fastify'
import { pubSub } from './pubsub'

const prisma = new PrismaClient()

export type GraphQLContext = {
  prisma: PrismaClient
  currentUser: User | null
  pubSub: typeof pubSub
}

export async function contextFactory(
  request: FastifyRequest,
  // Current user is injected by auth plugin
): Promise<Omit<GraphQLContext, 'currentUser'>> {
  return {
    prisma,
    pubSub,
  }
}
```

Now let's setup our `@envelop/generic-auth` plugin.

```ts
import { useGenericAuth } from '@envelop/generic-auth'
import { authenticateUser } from './auth'

const getEnvelop = envelop({
  plugins: [
    useSchema(schema),
    useExtendContext((ctx) => gqlContext(ctx.request)),
    useLogger(),
    useGenericAuth({
      resolveUserFn: authenticateUser,
      mode: 'protect-all',
    }),
    enableIf(process.env.NODE_ENV === 'production', disableIntrospection()),
  ],
})
```

If you now try making requests to the GraphQL API you will get `Unauthenticated Error` since now everything is protected. Lets add `@skipAuth` directive to our schema and make `info` field and `login`, `signup` mutations public.

```graphql
directive @skipAuth on FIELD_DEFINITION

type Query {
  info: String! @skipAuth
  feed(filter: String, skip: Int, take: Int, orderBy: LinkOrderByInput): Feed!
  me: User!
}

type Mutation {
  post(url: String!, description: String!): Link!
  signup(email: String!, password: String!, name: String!): AuthPayload
    @skipAuth
  login(email: String!, password: String!): AuthPayload
  vote(linkId: ID!): Vote
}
```
