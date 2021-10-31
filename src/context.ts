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
