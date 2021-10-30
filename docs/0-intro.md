# Introduction

In previous tutorial we built a GraphQL server for a HackerNews clone API with Node.js, Fastify, TypeScript, GraphQL-Helix and Prisma 3. We added authentication, filtering, pagination and subscriptions.

In this tutorial we will explore tools in the GraphQL JavaScript/TypeScript ecosystem that make it easy to build a GraphQL server for a real-world application.
You are going to use the following technologies:

We will extend from previous implementation and use the following technologies:

- [GraphQL Code Generator](https://www.graphql-code-generator.com): GraphQL Code Generator is a CLI tool that can generate TypeScript typings out of a GraphQL schema.
- [GraphQL Tools](https://graphql-tools.com): A set of utilities to build a GraphQL schema and resolvers in JavaScript, following the schema-first development workflow.
- [`envelop`](https://envelop.dev): A lightweight JavaScript/TypeScript library for customizing the GraphQL execution layer and flow, allowing developers to build, share and collaborate on GraphQL-related plugins while filling the missing pieces in GraphQL implementations

### What to expect?

We will start from the server we made in last tutorial
and dive deep into understanding the GraphQL execution pipeline and use tools in the JavaScript/TypeScript ecosystem to build a GraphQL server for a real-world application.
