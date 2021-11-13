import 'graphql-import-node'
import fastify, { FastifyContext, FastifyRequest } from 'fastify'
import {
  getGraphQLParameters,
  processRequest,
  Request,
  sendResult,
  shouldRenderGraphiQL,
  renderGraphiQL,
} from 'graphql-helix'
import {
  envelop,
  useExtendContext,
  useLogger,
  useSchema,
  enableIf,
} from '@envelop/core'
import { schema } from './schema'
import {
  contextFactory as gqlContext,
  GraphQLContext,
  liveQueryStore,
} from './context'
import { disableIntrospection } from './disable-introspection'
import { useGenericAuth } from '@envelop/generic-auth'
import { authenticateUser } from './auth'
import { useLiveQuery } from '@envelop/live-query'
import { User } from '.prisma/client'

const getEnvelop = envelop({
  plugins: [
    useSchema(schema),
    useLiveQuery({ liveQueryStore }),
    useExtendContext((ctx) => gqlContext(ctx.request)),
    useLogger(),
    useGenericAuth<User, GraphQLContext & { req: FastifyRequest['req'] }>({
      resolveUserFn: authenticateUser,
      mode: 'protect-all',
    }),
    enableIf(process.env.NODE_ENV === 'production', disableIntrospection()),
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

main()
