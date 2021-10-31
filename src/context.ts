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
