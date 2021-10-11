GraphQL Type System defines different capabilities of the GraphQL service. In previous tutorial we use the GraphQL SDL to create our schema and then wrote our schema. As you grow that schema it will be harder to keep track what all things your resolvers are returning or what all values are being passed in to your resolvers. What if we can get intellisense from our IDEs or static type checking from our compilers? That is exactly what GraphQL codegen does it takes your GraphQL schema and generates types for many different languages. For this tutorial we are using TypeScript so we will setup GraphQL codegen to generate TypeScript types we can get IDE and static type checkers to warn us if we miss something. This makes our code more easier to maintain.

1. Install GraphQL codegen cli and TypeScript generator.

   ```bash
   npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-resolvers
   ```

2. Create a `codegen.yml`
   ```yml
   overwrite: true
   schema: './src/**/*.graphql'
   generates:
   ./src/generated/graphql.ts:
   plugins:
     - 'typescript'
     - 'typescript-resolvers'
   ```
3. Add a `generate` script to `package.json`
   ```json
     "generate": "graphql-codegen --config codegen.yml"
   ```
4. Run `npm run generate` and now you should have a `./src/generated/graphql.ts` file with all the types generated from GraphQL SDL for you resolvers.
5. You can add `generated/` to `.gitignore` to exclude generated files.

We will use this generated types to strongly type our resolvers which will help us to make sure we are not returning any unexpected values and keep our code maintainable.

Now in `src/schema.ts` we will import `Resolvers` type for our `resolver object.

```ts
import { Resolvers } from './generated/graphql'
```

Annotate `resolver` object with `Resolvers` type and provide it our `GraphQLContext`.

```ts
const resolvers: Resolvers<GraphQLContext> = {
```

Now you should have many errors in your `src/schema.ts` file. We will fix these one by one. First we will remove all the type annotations we added manually.

Let's add a `check` script to `package.json` and resolve an error at a time.

```json
 "check": "tsc --noEmit"
```

Let's explore one error that will fix most of them.

```shell
src/schema.ts:13:5 - error TS2322: Type '(_: {}, args: RequireFields<QueryFeedArgs, never>, context: GraphQLContext) => Promise<{ count: number; links: Link[]; }>' is not assignable to type 'Resolver<ResolverTypeWrapper<Feed>, {}, GraphQLContext, RequireFields<QueryFeedArgs, never>> | undefined'.
  Type '(_: {}, args: RequireFields<QueryFeedArgs, never>, context: GraphQLContext) => Promise<{ count: number; links: Link[]; }>' is not assignable to type 'ResolverFn<ResolverTypeWrapper<Feed>, {}, GraphQLContext, RequireFields<QueryFeedArgs, never>>'.
    Type 'Promise<{ count: number; links: Link[]; }>' is not assignable to type 'ResolverTypeWrapper<Feed> | Promise<ResolverTypeWrapper<Feed>>'.
      Type 'Promise<{ count: number; links: Link[]; }>' is not assignable to type 'Promise<Feed>'.
        Type '{ count: number; links: Link[]; }' is not assignable to type 'Feed'.
          Types of property 'links' are incompatible.
            Type 'import("/Users/saihajpreetsingh/Desktop/graphql-typescript-node-tutorial/node_modules/.prisma/client/index").Link[]' is not assignable to type 'import("/Users/saihajpreetsingh/Desktop/graphql-typescript-node-tutorial/src/generated/graphql").Link[]'.
              Property 'votes' is missing in type 'import("/Users/saihajpreetsingh/Desktop/graphql-typescript-node-tutorial/node_modules/.prisma/client/index").Link' but required in type 'import("/Users/saihajpreetsingh/Desktop/graphql-typescript-node-tutorial/src/generated/graphql").Link'.
```

The issue is that as per our schema `Feed` has `links` property which has `votes` property on it. But in Prisma these are two different tables and it doesn't join them. But we have Field resolver for `votes` which will take care of resolving so on parent we shouldn't need to worry about fulfilling all the data. So how do we express this to TypeScript so it is happy?

```graphql
type Feed {
  links: [Link!]!
  count: Int!
}
type Link {
  id: ID!
  description: String!
  url: String!
  postedBy: User
  votes: [Vote!]!
}
```

We basically need to override type from our schema with Prisma types. GraphQL codegen allows us to map our models to GraphQL types [docs](https://www.graphql-code-generator.com/docs/plugins/typescript-resolvers#use-your-model-types-mappers). Before we map types let's customize our script so we generate prisma and codegen types together. Update you `package.json`:

```json
  "generate": "npm run generate:prisma && npm run generate:codegen",
  "generate:codegen": "graphql-codegen --config codegen.yml",
  "generate:prisma": "prisma generate",
```

Now let's map `Link`, `User` and `Vote` from our Prisma model to GraphQL types. Update your `codegen.yml` to following:

```yml
overwrite: true
schema: './src/**/*.graphql'
generates:
  ./src/generated/graphql.ts:
    plugins:
      - 'typescript'
      - 'typescript-resolvers'
    config:
      mappers:
        Link: .prisma/client#Link as LinkModel
        User: .prisma/client#User as UserModel
        Vote: .prisma/client#Vote as VoteModel
```

Now run `npm run generate` and then `npm run check` you should have way less errors.

[Insert Input Maybe blog post from Gilad]
