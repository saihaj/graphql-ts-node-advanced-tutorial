# Introduction

In previous tutorial we built a GraphQL server for HackerNews clone API with Node.js, Fastify, TypeScript, GraphQL-Helix and Prisma 3. We added authentication, filtering, pagination and subscriptions.

### What to expect?

In this tutorial we will explore tools in the GraphQL JavaScript/TypeScript ecosystem that make it easy to build a GraphQL server for real-world applications. We will extend the implementation from previous tutorial and use the following technologies:

- [GraphQL Code Generator](https://www.graphql-code-generator.com): Helps generate types for resolvers from GraphQL Schema.
- [GraphQL Tools](https://graphql-tools.com): Set of utilities that help compose GraphQL schemas and resolvers.
- [`envelop`](https://envelop.dev): Library for customizing the GraphQL execution layer and flow. We will use this to add authentication, disable introspection, customizing context for resolvers, etc.
