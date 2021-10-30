# What is `envelop`?

It is a powerful tool to extend the GraphQL execution pipeline. It is a thin wrapper around `graphql-js` that let's you customize the GraphQL execution pipeline. You can write your own plugins or use from a large collection of community managed plugins. You can use this with any compatible GraphQL server.

When using GraphQL Helix it is very simple to extend the GraphQL execution pipeline using `envelop`.

# Using `envelop`

One of the common things that you will want to do in your GraphQL server is to add logging. We can do this manually by adding logs in our resolvers or we can just use `envelop` to add logs.

## Installation

1. `npm i @envelop/core`

We instantiate instance of `envelop` with set of plugins we want and it provides a function that will take our incoming request and return functions that are used in execution pipeline. So we provide these custom execute functions to our server.

So rather than providing schema directly to server we will provide to `envelop` and use the one exported by it.

```ts
import { envelop, useSchema, useExtendContext } from '@envelop/core'
import { schema } from './schema'
import { contextFactory as gqlContext } from './context'

const getEnvelop = envelop({
  plugins: [
    //  this is used to provide schema to our server
    useSchema(schema),
    // we override the contextFactory to use our own context factory
    // using this we can combine different contexts
    useExtendContext(gqlContext),
  ],
})

async function main() {
  const server = fastify()

  server.route({
    method: ['POST', 'GET'],
    url: '/graphql',
    handler: async (req, reply) => {
      const request: Request = {
        headers: req.headers,
        method: req.method,
        query: req.query,
        body: req.body,
      }

      if (shouldRenderGraphiQL(request)) {
        reply.header('Content-Type', 'text/html')
        reply.send(
          renderGraphiQL({
            endpoint: '/graphql',
          }),
        )

        return
      }

      // We use envelop and it provide us with execute pipeline functions that we will provide to helix to process request.
      const { parse, validate, contextFactory, execute, schema } = getEnvelop({
        req,
      })
      const { operationName, query, variables } = getGraphQLParameters(request)

      const result = await processRequest({
        request,
        schema,
        operationName,
        query,
        variables,
        parse,
        validate,
        contextFactory,
        execute,
      })

      sendResult(result, reply.raw)
    },
  })

  server.listen(3000, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:3000/`)
  })
}
```

Now lets see how we can use `envelop` to add logging to our GraphQL server.

```ts
import { envelop, useSchema, useExtendContext, useLogger } from '@envelop/core'
import { schema } from './schema'
import { contextFactory as gqlContext } from './context'

const getEnvelop = envelop({
  plugins: [
    //  this is used to provide schema to our server
    useSchema(schema),
    // we override the contextFactory to use our own context factory
    // using this we can combine different contexts
    useExtendContext((ctx) => gqlContext(ctx.request)),
    //this will log all operations before and after different execution phases
    useLogger(),
  ],
})
```

We can customize this logger and log different things and without having to add logs everywhere manually.
