# Writing `envelop` plugin

In previous section we learned about `envelop` and how we can use it to customize the execution pipeline. In this section let's use it to create our own plugin.

## What are we making?

We are making a private GraphQL API i.e. we do not want public to directly access our HN API directly. This should only be used by our clients (web/mobile apps). Introspection is a GraphQL query that allows us to see the schema of our GraphQL API. This is useful for development tools, like GraphiQL which allow us to run and explore our API easily. In production we do not want public to explore the underlying schema. We can easily disable introspection by adding a validation rule to our schema. Let's make a `envelop` plugin that will disable introspection.

## Code time

We use the `Plugin` interface from `envelop` to create a plugin. `graphql` provides us with a [Custom Validation rule](https://github.com/graphql/graphql-js/blob/d35bca5f7e1eea49804c46ef9c7bd35791759b6d/src/validation/rules/custom/NoSchemaIntrospectionCustomRule.ts#L11-L21_ that can be used to disable introspection. `validate` phase is run before `execute` phase to ensure our operations are mistake free. This custom rule from `graphql` just checks if the incoming query is [`IntrospectionQuery`](https://github.com/graphql/graphql-js/blob/d35bca5f7e1eea49804c46ef9c7bd35791759b6d/src/utilities/getIntrospectionQuery.ts) or not. If it is, it will throw an error. [`envelop` validate](https://www.envelop.dev/docs/plugins/lifecycle#onvalidateapi) let's us add custom validation rules before the validate phase kicks in and we just add this rule from `graphql` to it. Now we can use this to disable introspection in our server.

```ts
// We import the `Plugin` interface from `envelop`
import { Plugin } from '@envelop/core'
// `graphql` provide us this custom rule that helps us disable introspection
import { NoSchemaIntrospectionCustomRule } from 'graphql'

export const disableIntrospection = (): Plugin => {
  return {
    // https://www.envelop.dev/docs/plugins/lifecycle#onvalidateapi
    onValidate: ({ addValidationRule }) => {
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
}
```

Let's use this new plugin to disable introspection in our server. `envelop` provides us with a [`enableIf`](https://www.envelop.dev/docs/core#utilities) utility to conditionally allow plugins. We will use that to check if we are running in production mode or not and then provide our `disableIntrospection`.

```ts
import {
  envelop,
  useExtendContext,
  useLogger,
  useSchema,
  enableIf,
} from '@envelop/core'
import { schema } from './schema'
import { contextFactory as gqlContext } from './context'
import { disableIntrospection } from './disable-introspection'

const getEnvelop = envelop({
  plugins: [
    useSchema(schema),
    useExtendContext((ctx) => gqlContext(ctx.request)),
    useLogger(),
    enableIf(process.env.NODE_ENV === 'production', disableIntrospection()),
  ],
})
```
