# The Anatomy of a GraphQL Request

Before we determine what tools we wanna use for improving our GraphQL server setup, we wanna have a deeper understanding of what is actually happening and which purpose the existing libraries we used so far have.

```
                                       ┌────────────┐
                          Requests are │┌──────────┐│
        Make an HTTP      processed by ││  Parse   ││
     ┌─────request────┐    the GraphQL │└──────────┘│
     │                │     execution  │      │     │
     │                ▼      engine.   │      ▼     │
┌────────┐       ┌────────┐            │┌──────────┐│
│ Client │       │ Server │───────────▶││ Validate ││
└────────┘       └────────┘            │└──────────┘│
     ▲                │                │      │     │
     │  Return JSON   │                │      ▼     │
     └──object or ────┘                │┌──────────┐│
        stream of                      ││ Execute  ││
        data and/or                    │└──────────┘│
       error fields                    └────────────┘

```

## HTTP Parsing and Normalization

Clients send HTTP requests to the server with a payload that contains an operation document string (query, mutation or subscription) and optionally some variables and the operation name from the document that shall be executed.

Generally it is a JSON object for most requests that are executed via the POST http method.

**Example JSON POST Body**

```json
{
  "query": "query UserById($id: ID!) { user(id: $id) { id name } }",
  "variables": { "id": "10" },
  "operationName": "UserById"
}
```

However, when using the GET http method (e.g. for query operations) those parameters can also be provided as a query search string. The values are then URL-encoded.

**Example GET URL**

```
http://localhost:8080/graphql?query=query%20UserById%28%24id%3A%20ID%21%29%20%7B%20user%28id%3A%20%24id%29%20%7B%20id%20name%20%7D%20%7D&variables=%7B%20%22id%22%3A%20%2210%22%20%7DoperationName=UserById
```

The HTTP servers task is to parse and normalize the body or query string and furthermore determine the protocol that shall be used for sending the response. Currently the protocols can be `application/graphql+json` (or `application/json` for legacy clients) for a single result that yields from the execution phase, `multipart/mixed` for incremental delivery (when using `@defer` and `@stream` directives) or `text/event-stream` for event streams (e.g. when executing subscription operations).

All this heavy lifting of parsing and normalizing the request is performed by `graphql-helix`. It is note-worthy that GraphQL MUST not be performed over HTTP, we could choose any other protocol such as WebSockets instead. However, GraphQL over HTTP, is the most commonly used one that is furthermore backed by the GraphQL Foundation.

## GraphQL parse

After parsing and normalizing the request the server will pass on the GraphQL parameters onto the GraphQL engine which will first parse the GraphQL operation document (which can contain any number of query, mutation or subscription operations and fragment definitions).

If there is any typo or syntax error this phase will yield GraphQLErrors for each of those issues and pass them back to the server layer, so it can forward those back to the client.

For the following invalid GraphQL operation (`)` missing after `$id`):

```
query UserById($id: ID!) {
  user(id: $id {
    id
    name
  }
}
```

The error will look similar to this:

```json
{
  "message": "Syntax Error: Expected Name, found {",
  "locations": [
    {
      "line": 2,
      "column": 16
    }
  ]
}
```

As you can, see the error messages are unfortunately not always straight-forward and helpful. The location can, however, help you tracking down the syntax error!

In case no error occurs, the parse phase produces an AST (abstract syntax tree).

The AST is a handy format that is used for the follow-up phases `validate` and `execute`.

For our operation it would be identical to the following JSON:

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

This procedure is performed by the `parse` function that is exported from `graphql-js`. So far we did not encounter it in our code, as `graphql-helix` imports it from there and uses it internally within the `processRequest` function. Later, we will actually pass our custom `parse` function to `graphql-helix` to customize the behavior of this phase!

## GraphQL validate

In the validation phase the parsed document is checked against our GraphQL schema, in order to ensure all selected fields in the operation are actually available. The AST makes it easier for the validation rules to have a common interface of traversing the document.
Furthermore, other validation rules, that ensure that the document follows the GraphQL specification are checked. E.g. whether variables referenced in the document are declared in the operation definition and so on.

As an example the following operation is missing a definition for the `$id` variable:

```graphql
query UserById {
  user(id: $id) {
    id
    name
  }
}
```

If the AST of that operation would be validated the following error will be raised.

```json
[
  {
    "message": "Variable \"$id\" is not defined by operation \"UserById\".",
    "locations": [
      {
        "line": 2,
        "column": 12
      },
      {
        "line": 1,
        "column": 1
      }
    ]
  }
]
```

In case any error is raised the errors are forwarded to the HTTP layer which takes care of sending them back to the client over the determined protocol. Otherwise, if no errors are raised the `execution` phase will be performed next.

This procedure is performed by the `validate` function that is exported from `graphql-js`. So far we did not encounter it in our code, as `graphql-helix` imports it from there and uses it internally within the `processRequest` function. Later, we will actually pass our custom `validate` function to `graphql-helix` to customize the behavior of this phase! This will allow us to use custom validation rules for security and other purposes.

## GraphQL execute

In the execution phase we are actually resolving the data requested by the client using the parsed and validated GraphQL operation document AST and our GraphQL schema, which contains the resolvers that specify from where the data the client requests is retrieved.

Previously, the HTTP request has been parsed and normalized, which yielded the following additional (but optional) values: `variables` and `operationName`.

If the GraphQL document that will be used for execution included more than one executable mutation, query or subscription operation the `operationName` is determined to identify the document that shall be used.
In case the determined executable operation has any variable definitions, those are asserted against the `variables` values parsed from the HTTP request.

If anything goes wrong or is incorrect an error is raised. E.g. the variables provided are invalid or the operation that shall be executed cannot be determined as the `operationName` is invalid or missing.

**Example error for anonymous document alongside named document**

```graphql
query UserById($id: ID!) {
  user(id: $id) {
    id
    name
  }
}
query {
  __typename
}
```

```json
{
  "errors": [
    {
      "message": "This anonymous operation must be the only defined operation.",
      "locations": [
        {
          "line": 7,
          "column": 1
        }
      ]
    }
  ]
}
```

Such an error will again be forwarded to the client by the HTTP layer.

Otherwise, if no error occurs, the field values will be resolved with all the parsed and provided parameters. The phase yields a single or stream of JSON serializable GraphQL Execution Result.

```json
{
  "data": {
    "user": {
      "id": "10",
      "name": "Laurin"
    }
  }
}
```

Again the HTTP layer forwards those to the client.

This procedure is performed by the `execute` and `subscribe` functions that are exported from `graphql-js`. So far we did not encounter it in our code, as `graphql-helix` imports those from there and uses them internally within the `processRequest` function. Later, we will actually pass our custom `execute` and `subscribe` function functions to `graphql-helix` for customizing the behavior of this phase! This will allow us to log operations or mask unexpected errors (such as database errors) from the clients.

# Why are we using GraphQL Helix?

Implementing the logic for parsing and normalizing the HTTP request is time consuming and an error prone process. By leveraging a well maintained and tested library that follows the GraphQL over HTTP specification we can reduce the time required for building a GraphQL HTTP server. Furthermore, it allows us to customize and replace the functions used for doing the `parse`, `validate` and `execute`/`subscribe` phases. It is a light-weight wrapper around `graphql-js` with maximum flexibility.

# Why do we want to override different phases?

## `parse`

### Add Caching

Parsing a GraphQL document string comes with an overhead. We could cache frequently sent document strings and serve the document from the cache instead of parsing it every single time.

### Test new Functionality

The GraphQL Type system defines the capabilities of the GraphQL service.
This phase can be used to add add new capabilities to the type system that may not yet be supported by GraphQL specification.

## `validate`

### Add caching

Similar to parsing, validating a GraphQL document AST comes with an overhead. We could cache reoccurring document ASTs and server the validation result from the cache instead of validating it every single time.

### Add custom rules

You might wanna restrict what kind of operations are allowed to be executed. E.g. if we only want to allow `query` operations, we can provide a custom validation rule that yields errors as soon as a `mutation` or `subscription` operation is encountered.

## `execute` and `subscribe`

### Add caching

We can serve frequently executed GraphQL operation results from a cache instead of calling all our resolvers and fetching from a remote database/server every time.

### Add tracing information

We can collect statistics by measuring how long it takes to resolve each field in our documents selection set and narrow down bottle-necks.

### Mask and report errors

We wanna make sure the errors occurring during the execution do not contain sensitive information and are properly reported, so they do not go unnoticed and are properly reported.

### Add new functionality

We could customize the algorithm that is used by `graphql-js` in order to add new features or make it more performant.
