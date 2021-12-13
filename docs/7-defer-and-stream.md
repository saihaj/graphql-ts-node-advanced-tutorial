# Incremental delivery

GraphQL gives us ability to fetch fields that are needed. So no more no less. So server will ensure all fields are there and then it is returned to the client. So response time depends on the long the slowest field resolver takes to resolve. In real world not all requested data has the same importance so for some use cases we can get subset of fields. What if we could prioritize some fields and then return them to the client?

Enters `@defer` and `@stream`:

With these directives clients can specify priority of fields. We chunk the response into multiple responses and send them to client. To de-prioritize a field we can use `@defer` directive, server will omit the field from initial response and send it in subsequent response. To chunk the response for lists we can use `@stream` directive. In initial response some items from list are included and additional items are sent in subsequent responses.

To learn more about incremental delivery checkout this [RFC](https://github.com/graphql/graphql-wg/blob/main/rfcs/DeferStream.md).

This feature is still in early stages and soon will become part of GraphQL specification. We can experiment with it in our playground. We just need to install experimental release of `graphql-js`.

```shell
npm i graphql@16.1.0-experimental-stream-defer.6
```

Now let's update the schema:

```ts
const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

export const schema = new GraphQLSchema({
  ...executableSchema.toConfig(),
  enableDeferStream: true,
})
```

Now let's modify our `Link` query resolver. On `url` field we will introduce a random delay. In a real world this field may come from some other service.

```ts
url: async (parent) => {
  await new Promise((res) => setTimeout(res, Math.random() * 1000))
  return parent.url
},
```

Now on GraphiQL if we try to run this query:

```graphql
{
  feed {
    links {
      url
      id
    }
  }
}
```

You should see a spinner and we wait for all links to be fetched and then see the response.

![without defer and stream](https://i.imgur.com/7AY2Bia.gif)

Now let's try out `@defer` directive:

```graphql
{
  feed {
    links {
      ... on Link @defer {
        url
      }
      id
    }
  }
}
```

Now you can see we get the response instantly and then urls are sent in subsequent responses.

![with defer](https://i.imgur.com/Nl5lX1j.gif)

`@defer` is useful for fields that are expensive to fetch and are not very high priority for our clients to show. But when we are showing a list it is more important that we show the first item as soon as possible. So we can use `@stream` directive to chunk the list. In this case we will return the first item and then rest of the items in subsequent responses.

```graphql
{
  feed {
    links @stream(initialCount: 1) {
      url
    }
  }
}
```

![with stream](https://i.imgur.com/X9Ya9QT.gif)
