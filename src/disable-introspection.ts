import { Plugin } from '@envelop/core'
import { NoSchemaIntrospectionCustomRule } from 'graphql'

export const disableIntrospection = (): Plugin => {
  return {
    // https://www.envelop.dev/docs/plugins/lifecycle#onvalidateapi
    onValidate: ({ addValidationRule }) => {
      // See https://github.com/graphql/graphql-js/blob/d35bca5f7e1eea49804c46ef9c7bd35791759b6d/src/validation/rules/custom/NoSchemaIntrospectionCustomRule.ts#L11-L21
      addValidationRule(NoSchemaIntrospectionCustomRule)
    },
  }
}
