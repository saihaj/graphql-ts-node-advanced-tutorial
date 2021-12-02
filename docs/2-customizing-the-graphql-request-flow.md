# Customizing the GraphQL request flow

In the previous chapter you learned about the anatomy of the GraphQL request. Based on that new knowledge you will now learn how you can customize the GraphQL request.

## Custom validation rules and AST visitors

Customizing your GraphQL server with validation rules is a common practice. Let's say we want to make our API more safe, by disabling introspection, so that potential malicious API consumers can not see all the types and fields available in our GraphQL schema.
The best place to do that is within the validation phase.

First we must prepare our GraphQL HTTP request handler to accept new rules.

```diff
+ import {
+  ValidationRule,
+  specifiedRules,
+  validate as defaultValidate,
+ } from 'graphql'

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);



+     const validate: typeof defaultValidate = (
+       schema,
+       documentAST,
+       _rules /** we overwrite the rules */,
+       ...args
+     ) => {
+       const rules: Array<ValidationRule> = [...specifiedRules]
+       return validate(schema, documentAST, rules, ...args)
+     }


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
+      validate,
    });

    sendResult(result, reply.raw);
  }
});
```

With this setup we overwrote the `validate` function that `graphql-helix` is using and can now add additional rules to our `rules` array. We also need to add the default rules (which ensure the document follows the GraphQL specification), to the `rules` array. Conveniently, `graphql-js` exports those as the `specifiedRules` array.

Now that your GraphQL handler is ready for validating custom `ValidationRule`s, we can start with defining our custom rule. The `ValidationRule` type as exported from `graphql-js` helps us with the typings.

```ts
const DisableIntrospectionValidationRule: ValidationRule = (context) => {
  return {}
}
```

A validation rule is a function that has a single parameter of the type `ValidationContext`. The validation context has useful functions attached that help us with implementing our validation rule.

As you learned previously, the GraphQL `validate` phase uses the parsed GraphQL document AST. A handy and performant way of traversing such a document AST is using the AST visitor pattern. But what does that actually mean?

Let's inspect the AST we had a brief look within the last chapter. As you can see that all the objects have a `kind` property, e.g. `Document`, `VariableDefinition`, `Argument`, `Field` and `SelectionSet`.

```json
{
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "UserById"
      },
      "variableDefinitions": [
        {
          "kind": "VariableDefinition",
          "variable": {
            "kind": "Variable",
            "name": {
              "kind": "Name",
              "value": "id"
            }
          },
          "type": {
            "kind": "NonNullType",
            "type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "ID"
              }
            }
          }
        }
      ],
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "user"
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": {
                  "kind": "Name",
                  "value": "id"
                },
                "value": {
                  "kind": "Variable",
                  "name": {
                    "kind": "Name",
                    "value": "id"
                  }
                }
              }
            ],
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "id"
                  }
                },
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "name"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

An AST visitor is an object with hooks/handler functions for specific entities, that are specified through the `kind` property in the document AST.

```ts
import { ASTVisitor } from 'graphql'
const visitor: ASTVisitor = {
  Field(astNode) {
    console.log('a field is handled', astNode)
  },
  Argument(astNode) {
    console.log('an argument is handled', astNode)
  },
}
```

A validation rule returns an `ASTVisitor`. The `validate` functions instantiates a `ValidationContext` and then gathers the `ASTVisitors` of all the provided `ValidationRules` by calling them with the `ValidationContext` as a parameter. Then the document AST is traversed. Once an object with a `kind` property is encountered, the `ASTVisitors` that have a handler for such a node defined will be called.

After the document AST has been traversed and all handlers have been invoked the reported validation errors will be returned from the `validate` function. If no error has been encountered, the function will return `undefined`.

In our case we want to leverage the ASTVisitor to track down GraphQL introspection fields and then report a `GraphQLError` for those.

**Example introspection query operation for fetching all type names**

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
    }
  }
}
```

**Example introspection query operation AST**

```json
{
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "IntrospectionQuery"
      },
      "directives": [],
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "__schema"
            },
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "types"
                  },
                  "selectionSet": {
                    "kind": "SelectionSet",
                    "selections": [
                      {
                        "kind": "Field",
                        "name": {
                          "kind": "Name",
                          "value": "name"
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

As you can see, the document AST does not contain any information about the actual types that will be resolved. The document is only a tree of documents, selection sets, field and sub-field selections.

The rules can use the `ValidationContext` for reporting validation errors, but also getting additional GraphQL type information for the AST node from the GraphQLSchema.

```ts
import { ValidationRule, GraphQLError } from 'graphql'

const DisableIntrospectionValidationRule: ValidationRule = (context) => {
  return {
    Field(astNode) {
      const type = context.getParentType()
      console.log('GraphQLType to which this field belongs to.', type)
      context.reportError(
        new GraphQLError(`Encountered field of type ${type}.`),
      )
    },
  }
}
```

For your `DisableIntrospectionValidationRule` you want to register a handler for all `Field` nodes and then check whether the field resolves to any of the `Introspection` GraphQL types. To determine whether a type is an introspection type we can leverage the `isIntrospectionType` function exported from `graphql-js`.

```ts
import { ValidationRule, GraphQLError } from 'graphql'

const DisableIntrospectionValidationRule: ValidationRule = (context) => {
  return {
    Field(astNode) {
      // get the type of the field
      const type = getNamedType(context.getType())
      if (type && isIntrospectionType(type)) {
        context.reportError(
          new GraphQLError(
            `GraphQL introspection has been disabled, but the requested query contained the field "${node.name.value}".`,
            astNode,
          ),
        )
      }
    },
  }
}
```

Now you have written your first custom validation rule! The last missing step is to add the new validation rule to the array of rules used for the validation.

```diff
import {
  ValidationRule,
  specifiedRules,
  validate as defaultValidate,
} from 'graphql'
+ import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const validate: typeof defaultValidate = (
      schema,
      documentAST,
      _rules /** we overwrite the rules */,
      ...args
    ) => {
-       const rules: Array<ValidationRule> = [...specifiedRules]
+       const rules: Array<ValidationRule> = [...specifiedRules, DisableIntrospectionValidationRule]
      return validate(schema, documentAST, rules, ...args)
    }


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
      validate,
    });

    sendResult(result, reply.raw);
  }
});
```

Let's also practice by writing another rule for only allowing query operations and disallow mutation or subscription operations. When you have another look at the AST, you can see that type of an operation is specified on the `OperationDefinition` nodes `operation` property.

**Example query operation**

```graphql
query BasicQuery {
  __typename
}
```

```json
{
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "BasicQuery"
      },
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "__typename"
            }
          }
        ]
      }
    }
  ]
}
```

**Example mutation operation**

```graphql
mutation BasicMutation {
  __typename
}
```

```json
{
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "mutation",
      "name": {
        "kind": "Name",
        "value": "BasicMutation"
      },
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "__typename"
            }
          }
        ]
      }
    }
  ]
}
```

Therefore, we need to return an `ASTVisitor` from our validation rule that has a handler for `OperationDefinition` nodes.

```ts
import { ValidationRule, GraphQLError } from 'graphql'

const AllowOnlyQueryOperationsValidationRules: ValidationRule = (context) => {
  return {
    OperationDefinition(astNode) {
      if (astNode.operation !== 'query') {
        context.reportError(
          new GraphQLError(
            `Operation of type '${astNode.operation}' encountered. Only query operations are allowed.`,
            astNode,
          ),
        )
      }
    },
  }
}
```

By providing the `astNode` to our `GraphQLError`, the reported error that is sent to the client contains a location information that can help API consumers spot what part of a GraphQL document failed the validation phase and must be adjusted before trying to execute the operation again.

## Logging execution and subscribe errors

By default errors occurring during the call of `execute` and `subscribe` are only forwarded to the client, but not logged to the console on the server. Because of that behavior errors could be occurring unnoticed. Lets overwrite the `execute` and `subscribe` functions so that the errors are logged to the server console.

We start of basic by providing `execute` to the `processRequest` function from `graphql-helix`

```diff
import {
  ValidationRule,
  specifiedRules,
  validate as defaultValidate,
+  execute as defaultExecute,
} from 'graphql'
import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const validate: typeof defaultValidate = (
      schema,
      documentAST,
      _rules /** we overwrite the rules */,
      ...args
    ) => {
      const rules: Array<ValidationRule> = [...specifiedRules, DisableIntrospectionValidationRule]
      return validate(schema, documentAST, rules, ...args)
    }

+    const execute: typeof defaultExecute = async (...args) => {
+      const result = await defaultExecute(...args)
+      return result
+    }


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
      validate,
+      execute,
    });

    sendResult(result, reply.raw);
  }
});
```

Pretty straight-forward, and similar to what we did with `validate` previously. Now you can simply iterate through the error (if any occurred) and log them along-side the GraphQL operation that caused them.

```diff
import {
  ValidationRule,
  specifiedRules,
  validate as defaultValidate,
  execute as defaultExecute,
+  print,
} from 'graphql'
import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const validate: typeof defaultValidate = (
      schema,
      documentAST,
      _rules /** we overwrite the rules */,
      ...args
    ) => {
      const rules: Array<ValidationRule> = [...specifiedRules, DisableIntrospectionValidationRule]
      return validate(schema, documentAST, rules, ...args)
    }

    const execute: typeof defaultExecute = async (args) => {
      const result = await defaultExecute(args)
+      if (result.errors) {
+        console.log(
+          '-----\n' +
+            'Errors occurred while executing the following document:\n' +
+            print(args.document) +
+            '\n\n' +
+            result.errors.map((error) => String(error)).join('\n\n') +
+            '\n-----\n',
+        )
+      }
      return result
    }


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
      validate,
      execute,
    });

    sendResult(result, reply.raw);
  }
});
```

Overwriting the `subscribe` function is a bit more tricky, as it either returns a single result or a stream of results. We need to first identify whether we are dealing with a stream and then apply the logging for each value published by the stream or once for a single value, in case a subscription does not result in a stream (usually, when setting up the subscription fails).

```diff
import {
  ValidationRule,
  specifiedRules,
  validate as defaultValidate,
  execute as defaultExecute,
+  subscribe as defaultSubscribe,
+  isAsyncIterable,
+  ExecutionResult,
  print,
} from 'graphql'
import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const validate: typeof defaultValidate = (
      schema,
      documentAST,
      _rules /** we overwrite the rules */,
      ...args
    ) => {
      const rules: Array<ValidationRule> = [...specifiedRules, DisableIntrospectionValidationRule]
      return validate(schema, documentAST, rules, ...args)
    }

+    const applyErrorLogging = (result: ExecutionResult) => {
+      if (result.errors) {
+        console.log(
+          '-----\n' +
+            'Errors occurred while executing' +
+            '\n\n' +
+            result.errors.map((error) => String(error)).join('\n\n') +
+            '\n-----\n',
+        )
+      }
+    }

    const execute: typeof defaultExecute = async (args) => {
      const result = await defaultExecute(args)
-      if (result.errors) {
-        console.log(
-          '-----\n' +
-            'Errors occurred while executing the following document:\n' +
-            print(args.document) +
-            '\n\n' +
-            result.errors.map((error) => String(error)).join('\n\n') +
-            '\n-----\n',
-        )
-      }
+      applyErrorLogging(result)
      return result
    }

+    async function* mapStream(stream: AsyncIterable<ExecutionResult>) {
+      for await (const result of stream) {
+        applyErrorLogging(result)
+        yield result
+      }
+    }

+    const subscribe: typeof defaultSubscribe = async (args) => {
+      const result = await defaultSubscribe(args)
+      if (isAsyncIterable(result)) {
+         return mapStream(result)
+      }
+      applyErrorLogging(result)
+      return result
+    }

    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
      validate,
      execute,
    });

    sendResult(result, reply.raw);
  }
});
```

## Envelop, the missing GraphQL plugin system

As you can see, adding the code in the previous steps clutters your HTTP request handler quite a lot. Adding more customizations will make your handler code more complex and complicated to maintain. Furthermore, for new projects you have to copy and paste or re-implement the same custom logic over and over again.
If you have worked with other frameworks before you might be familiar with plugin systems. Some frameworks expose hooks that can be used for executing custom logic before and after certain processes are happening within the framework logic.
Unfortunately, `graphql-js` does not come with such a plugin system and the main focus of `graphql-helix` is HTTP request normalization. In the past full-stack GraphQL servers have provided such hook interfaces, but did not let you customize all aspects. However, the GraphQL community came up with a library that fills the gap of a fully-customizable GraphQL plugin system, `Envelop`.

Envelop wraps the core functions from `graphql-js` and provides a convenient interface for writing composable plugins. Let's reset the GraphQL HTTP handler to the state before adding the custom validation rules and the error loggers and add a basic envelop setup.

```diff
+ import { envelop, useSchema } from '@envelop/core'
import { schema } from './schema'

+ const getEnveloped = envelop({
+   plugins: [
+     useSchema(schema),
+   ],
+ });

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

+    const { parse, validate, contextFactory, execute, subscribe, schema } = getEnveloped({ request, operationName, query, variables });


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
+      context: await contextFactory(),
+      parse,
+      validate,
+      execute,
+      subscribe,
    });

    sendResult(result, reply.raw);
  }
});
```

The `envelop` function takes a list of plugins that should be registered and returns a `getEnveloped` factory function that returns all the adjusted core function overwrites from `graphql-js`, that call the hooks defined in plugins.
But what does such a plugin actually look like?

Let's start by rebuilding a plugin that registers the `DisableIntrospectionValidationRule` you built in the previous steps.
A plugin is described by the `Plugin` type exported from the `@envelop/core` package and is an object that has handlers for hooking into all the phases before and after `parse`, `validate`, `execute` and `subscribe`.

In your case, you want to register a validation rule before `validate` is being called. The correct hook for that is `onValidate`. Each hook receives a context with convenience methods for making stuff such as adding a validation rule easier.

```ts
import type { Plugin } from '@envelop/core'
import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

export const useDisableIntrospection = (): Plugin => {
  return {
    onValidate(onValidateContext) {
      onValidateContext.addValidationRule(DisableIntrospectionValidationRule)
    },
  }
}
```

After you wrote the plugin it can simply be added to the envelop setup.

```diff
import { envelop, useSchema } from '@envelop/core'
import { schema } from './schema'
+ import { useDisableIntrospection } from './useDisableIntrospection'

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
+    useDisableIntrospection(),
  ],
});

server.route({
  method: "POST",
  url: "/graphql",
  handler: async (req, reply) => {
    const request: Request = {
      headers: req.headers,
      method: req.method,
      query: req.query,
      body: req.body,
    };

    const { operationName, query, variables } = getGraphQLParameters(request);

    const { parse, validate, contextFactory, execute, subscribe, schema } = getEnveloped({ request, operationName, query, variables });


    const result = await processRequest({
      request,
      schema,
      operationName,
      query,
      variables,
      context: await contextFactory(),
      parse,
      validate,
      execute,
      subscribe,
    });

    sendResult(result, reply.raw);
  }
});
```

In the `getEnveloped({ request, operationName, query, variables })` call, you are passing the raw HTTP request into the plugin context.
You can now even further improve the plugin and allow introspection if a specific HTTP header is provided.

```diff
import type { Plugin } from '@envelop/core'
import { DisableIntrospectionValidationRule } from './DisableIntrospectionValidationRule'

const useDisableIntrospection = (): Plugin => {
  return {
    onValidate(onValidateContext) {
+      const allowIntrospectionKey =
+        onValidateContext.context.request?.headers.get('x-allow-introspection')

+      if (allowIntrospectionKey !== 'secret-key') {
        onValidateContext.addValidationRule(DisableIntrospectionValidationRule)
+      }
    },
  }
}
```

Now all requests that send along a `x-allow-introspection: secret-key` headers are actually able to still perform introspection.

The best part of this is that the `useDisableIntrospection` can just be put into a npm package within your organization and be re-used and maintained for multiple projects. The base requirement is that your team uses envelop. Even if another GraphQL Server is not doing GraphQL over HTTP but WebSockets or any other protocol, the plugin can still be used!

In fact this specific plugin is already available on npm, so you don't need to write it yourself and can use an already well maintained and tested plugin from the community.

```diff
import { envelop, useSchema } from '@envelop/core'
import { schema } from './schema'
- import { useDisableIntrospection } from './useDisableIntrospection'
+ import { useDisableIntrospection } from '@envelop/disable-introspection';

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useDisableIntrospection(),
  ],
});
```

For a better understanding, let's also implement the `execute` and `subscribe` error logger plugin using the envelop plugin API.

```ts
import { Plugin } from '@envelop/core'
import { ExecutionResult } from 'graphql'

const applyErrorLogging = (result: ExecutionResult) => {
  if (result.errors) {
    console.log(
      '-----\n' +
        'Errors occurred while executing' +
        '\n\n' +
        result.errors.map((error) => String(error)).join('\n\n') +
        '\n-----\n',
    )
  }
}

const useErrorLogger = (): Plugin => {
  return {
    onExecute(onExecuteContext) {
      console.log('before execute is called')

      return {
        onExecuteDone(onExecuteDoneContext) {
          console.log('after execute is called')
          applyErrorLogging(onExecuteDoneContext.result as ExecutionResult)
        },
      }
    },
  }
}
```

As mentioned before, the plugin API allows hooking into the before and after phases of each of the `graphql-js` core functions. Envelop runs the `onExecute` handler first, then the `execute` logic as implemented by `graphql-js` and then calls an optional `onExecuteDone` handler that can be returned from `onExecute`. In the `onExecuteDone`, you can access the execution result and log it.

You can do the same for the `subscribe` function using the `onSubscribe` and `onSubscribeResult` hook.

```diff
import { Plugin, isAsyncIterable } from '@envelop/core'
- import { ExecutionResult } from 'graphql'
+ import { ExecutionResult, isAsyncIterable } from 'graphql'

const applyErrorLogging = (result: ExecutionResult) => {
  if (result.errors) {
    console.log(
      '-----\n' +
        'Errors occurred while executing' +
        '\n\n' +
        result.errors.map((error) => String(error)).join('\n\n') +
        '\n-----\n',
    )
  }
}

+ async function* mapStream(stream: AsyncIterable<ExecutionResult>) {
+   for await (const result of stream) {
+     applyErrorLogging(result)
+     yield result
+   }
+ }

const useErrorLogger = (): Plugin => {
  return {
    onExecute(onExecuteContext) {
      console.log('before execute is called')

      return {
        onExecuteDone(onExecuteDoneContext) {
          console.log('after execute is called')
          applyErrorLogging(onExecuteDoneContext.result as ExecutionResult)
        },
      }
    },
+    onSubscribe(onSubscribeContent) {
+      return {
+        onSubscribeResult(onSubscribeResult) {
+          if (isAsyncIterable(onSubscribeResult.result)) {
+            onSubscribeResult.setResult(mapStream(onSubscribeResult.result))
+          } else {
+            applyErrorLogging(onSubscribeResult.result)
+          }
+        },
+      }
+    },
+  }
}
```

Then you can simply add the plugin to the list of envelop plugins.

```diff
import { envelop, useSchema } from '@envelop/core'
import { schema } from './schema'
import { useDisableIntrospection } from '@envelop/disable-introspection'
+ import { useErrorLogger } from './useErrorLogger'

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useDisableIntrospection(),
+    useErrorLogger(),
  ],
});
```

As before, the community already solved this issue before, so you can just drop all that code and use the already existing plugin that is part of `@envelop/core`.

```diff
import { envelop, useSchema } from '@envelop/core'
import { schema } from './schema'
import { useDisableIntrospection } from '@envelop/disable-introspection'
- import { useErrorLogger } from './useErrorLogger'
+ import { useErrorHandler } from '@envelop/core'

const getEnveloped = envelop({
  plugins: [
    useSchema(schema),
    useDisableIntrospection(),
-    useErrorLogger(),
+    useErrorHandler(errors => {
+      console.log(
+        '-----\n' +
+          'Errors occurred while executing' +
+          '\n\n' +
+          result.errors.map((error) => String(error)).join('\n\n') +
+          '\n-----\n',
+      )
+    }),
  ],
});
```

The envelop plugin hub is the place to go for looking whether your GraphQL problem has been already solved by the community and might save you a lot of time in your upcoming GraphQL projects! If you like you can start a small digging session right now on https://www.envelop.dev/plugins.

Now you have a basic understanding of the GraphQL request flow and learned how envelop helps with customizing it

The next chapter will focus on how you can utilize envelop for making your GraphQL server production-ready in the next chapter!

