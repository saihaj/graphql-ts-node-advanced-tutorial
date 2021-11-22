# Introduction

In previous tutorial we built a GraphQL server for HackerNews clone API with Node.js, Fastify, TypeScript, GraphQL-Helix and Prisma 3. We added authentication, filtering, pagination and subscriptions.

### What to expect?

By the end of the tutorial, you will have a deep understanding of the life cycle of a GraphQL request. You will have an overview of various popular open-source GraphQL libraries and know how and when you should utilize them to your advantage. This includes things such as improved type-safety while building the GraphQL schema and operation logging, but you will also become familiar with upcoming GraphQL features, that are still in development and learn how you can use them today!

- [GraphQL Code Generator](https://www.graphql-code-generator.com): Helps generate types for resolvers from GraphQL Schema.
- [GraphQL Tools](https://graphql-tools.com): Set of utilities that help compose GraphQL schemas and resolvers.
- [`envelop`](https://envelop.dev): Library for customizing the GraphQL execution layer and flow. We will use this to add authentication, disable introspection, customizing context for resolvers, etc.
