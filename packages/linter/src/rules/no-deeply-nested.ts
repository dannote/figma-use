import { defineRule } from '../core/rule.ts'

interface Options {
  maxDepth?: number
}

export default defineRule({
  meta: {
    id: 'no-deeply-nested',
    category: 'structure',
    description: 'Avoid deeply nested layers that make the design hard to maintain',
    fixable: false,
  },

  check(node, context) {
    const options = context.getConfig<Options>()
    const maxDepth = options?.maxDepth ?? 6

    let depth = 0
    let current = node.parent
    while (current) {
      depth++
      current = (current as { parent?: unknown }).parent
    }

    if (depth > maxDepth) {
      context.report({
        node,
        message: `Layer nested ${depth} levels deep (max ${maxDepth})`,
        suggest: 'Flatten structure or extract into a component',
      })
    }
  },
})
