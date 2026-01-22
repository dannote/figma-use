import { defineRule } from '../core/rule.ts'

interface Options {
  minSize?: number
}

export default defineRule({
  meta: {
    id: 'min-text-size',
    category: 'accessibility',
    description: 'Text should be large enough to be readable (minimum 12px)',
    fixable: true,
  },

  match: ['TEXT'],

  check(node, context) {
    const options = context.getConfig<Options>()
    const minSize = options?.minSize ?? 12

    if (node.fontSize === undefined) return
    if (node.fontSize >= minSize) return

    context.report({
      node,
      message: `Text size ${node.fontSize}px is below minimum ${minSize}px`,
      suggest: `Increase to at least ${minSize}px for readability`,
      fix: {
        action: 'resize',
        params: { fontSize: minSize },
      },
    })
  },
})
