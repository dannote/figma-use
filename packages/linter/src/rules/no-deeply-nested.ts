import { defineRule } from '../core/rule.ts'

import type { NodeRef } from '../core/types.ts'

interface Options {
  maxDepth?: number
}

interface NodeWithParent extends NodeRef {
  parent?: NodeWithParent
}

export default defineRule({
  meta: {
    id: 'no-deeply-nested',
    category: 'structure',
    description: 'Avoid deeply nested layers that make the design hard to maintain',
    fixable: false
  },

  check(node, context) {
    const options = context.getConfig<Options>()
    const maxDepth = options?.maxDepth ?? 6

    let depth = 0
    let current: NodeWithParent | undefined = node.parent as NodeWithParent
    while (current) {
      depth++
      current = current.parent
    }

    if (depth > maxDepth) {
      context.report({
        node,
        message: `Layer nested ${depth} levels deep (max ${maxDepth})`,
        suggest: 'Flatten structure or extract into a component'
      })
    }
  }
})
