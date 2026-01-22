import { defineRule } from '../core/rule.ts'

export default defineRule({
  meta: {
    id: 'no-groups',
    category: 'structure',
    description: 'Use frames instead of groups for better layout control and auto-layout support',
    fixable: false,
  },

  match: ['GROUP'],

  check(node, context) {
    context.report({
      node,
      message: 'Group should be converted to Frame',
      suggest: 'Groups cannot use Auto Layout. Convert to Frame for better control.',
    })
  },
})
