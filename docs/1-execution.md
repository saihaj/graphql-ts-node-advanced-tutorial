# What is execution?

GraphQL generates a response from a request via [execution](https://spec.graphql.org/June2018/#sec-Execution). Execution is the process of executing a GraphQL document against a GraphQL schema.

1. In execution process the request is parsed and validated against the schema if there are any errors request is failed without execution and list of errors are reported back.
2. If there are no errors variables from request are coerced and validated if there are any errors operation is failed without execution and list of errors are reported back.
3. Selected fields in the operation are resolved and if there are any errors they are added to list of errors and returned as `null` to the client.
   1. If a resolver fails due to a previous resolver is failed only one error is reported back to the client.
4. Returned response is well-formed and if there are any errors partial response with list of errors.
5. GraphQL spec doesn't specify the serialization format for responses but most implementations use JSON and that is what we will use here.

# Why use GraphQL helix?

`graphql-js` is a JavaScript/TypeScript reference implementation of the GraphQL specification. GraphQL Helix is built on top of `graphql-js` and provide collection of utilities to make it easier to build a GraphQL HTTP server. It allows for customization of different phases of the execution process. We can customize `execute`, `validate`, `parse` and `subscribe` from `graphql-js` to customize the execution process.

## What and why override different phases?

- `parse`: GraphQL Type system defines the capabilities of the GraphQL service. This phase can be used to add add new capabilities to the type system that may not be supported by GraphQL specification.
- `validate`: Validation is the done before executing. In this phase we can ensure that incoming operation are mistake-free. This can be used to add custom rules like you can use this to only allow `query` operations and if any other operation is tried it will be failed even before executing. -`execute`: This is the phase where your resolvers are called. Customizing this phase can allow you to run custom logic.
- `subscribe`: Customizing the behaviour of GraphQL subscription operations.
