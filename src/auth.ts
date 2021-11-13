import { User } from '@prisma/client'
import { FastifyRequest } from 'fastify'
import { JwtPayload, verify } from 'jsonwebtoken'
import { ResolveUserFn } from '@envelop/generic-auth'
import { GraphQLContext } from './context'

export const APP_SECRET = 'this is my secret'

export const authenticateUser: ResolveUserFn<
  User,
  GraphQLContext & { req: FastifyRequest['req'] }
> = async (context) => {
  if (context?.req?.headers?.authorization) {
    const token = context.req.headers.authorization.split(' ')[1]
    const tokenPayload = verify(token, APP_SECRET) as JwtPayload
    const userId = tokenPayload.userId

    return await context.prisma.user.findUnique({ where: { id: userId } })
  }

  return null
}
