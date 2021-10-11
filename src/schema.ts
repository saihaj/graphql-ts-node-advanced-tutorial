import { makeExecutableSchema } from '@graphql-tools/schema'
import { GraphQLContext } from './context'
import typeDefs from './schema.graphql'
import { APP_SECRET } from './auth'
import { hash, compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { PubSubChannels } from './pubsub'
import { Resolvers } from './generated/graphql'

const resolvers: Resolvers<GraphQLContext> = {
  Query: {
    info: () => `This is the API of a Hackernews Clone`,
    feed: async (_, args, context) => {
      const where = args.filter
        ? {
            OR: [
              { description: { contains: args.filter } },
              { url: { contains: args.filter } },
            ],
          }
        : {}

      const totalCount = await context.prisma.link.count({ where })
      const links = await context.prisma.link.findMany({
        where,
        skip: args.skip!,
        take: args.take!,
        orderBy: args.orderBy,
      })

      return {
        count: totalCount,
        links,
      }
    },
    me: (_, __, context) => {
      if (context.currentUser === null) {
        throw new Error('Unauthenticated!')
      }

      return context.currentUser
    },
  },
  User: {
    links: (parent, _, context) =>
      context.prisma.user
        .findUnique({ where: { id: parseInt(parent.id) } })
        .links(),
  },
  Vote: {
    link: (parent, _, context) =>
      context.prisma.vote
        .findUnique({ where: { id: parseInt(parent.id) } })
        .link(),
    user: (parent, _, context) =>
      context.prisma.vote
        .findUnique({ where: { id: parseInt(parent.id) } })
        .user(),
  },
  Link: {
    id: (parent) => parent.id,
    description: (parent) => parent.description,
    url: (parent) => parent.url,
    votes: (parent, _, context) =>
      context.prisma.link
        .findUnique({ where: { id: parseInt(parent.id) } })
        .votes(),
    postedBy: async (parent, _, context) => {
      if (!parent.postedBy) return null

      return context.prisma.link
        .findUnique({ where: { id: parseInt(parent.id) } })
        .postedBy()
    },
  },
  Mutation: {
    post: async (_, args, context) => {
      if (context.currentUser === null) {
        throw new Error('Unauthenticated!')
      }

      const newLink = await context.prisma.link.create({
        data: {
          url: args.url,
          description: args.description,
          postedBy: { connect: { id: context.currentUser.id } },
        },
      })

      context.pubSub.publish('newLink', { createdLink: newLink })

      return newLink
    },
    signup: async (parent, args, context) => {
      const password = await hash(args.password, 10)

      const user = await context.prisma.user.create({
        data: { ...args, password },
      })

      const token = sign({ userId: user.id }, APP_SECRET)

      return {
        token,
        user,
      }
    },
    login: async (parent, args, context) => {
      const user = await context.prisma.user.findUnique({
        where: { email: args.email },
      })
      if (!user) {
        throw new Error('No such user found')
      }

      const valid = await compare(args.password, user.password)
      if (!valid) {
        throw new Error('Invalid password')
      }

      const token = sign({ userId: user.id }, APP_SECRET)

      return {
        token,
        user,
      }
    },
    vote: async (_, args, context) => {
      // 1
      if (!context.currentUser) {
        throw new Error('You must login in order to use upvote!')
      }

      // 2
      const userId = context.currentUser.id

      // 3
      const vote = await context.prisma.vote.findUnique({
        where: {
          linkId_userId: {
            linkId: Number(args.linkId),
            userId: userId,
          },
        },
      })

      if (vote !== null) {
        throw new Error(`Already voted for link: ${args.linkId}`)
      }

      // 4
      const newVote = await context.prisma.vote.create({
        data: {
          user: { connect: { id: userId } },
          link: { connect: { id: Number(args.linkId) } },
        },
      })

      context.pubSub.publish('newVote', { createdVote: newVote })

      return newVote
    },
  },
  Subscription: {
    newLink: {
      subscribe: (_, __, context) => {
        return context.pubSub.asyncIterator('newLink')
      },
      resolve: (payload: PubSubChannels['newLink'][0]) => {
        return payload.createdLink
      },
    },
    newVote: {
      subscribe: (_, __, context) => {
        return context.pubSub.asyncIterator('newVote')
      },
      resolve: (payload: PubSubChannels['newVote'][0]) => {
        return payload.createdVote
      },
    },
  },
}

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})
