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
