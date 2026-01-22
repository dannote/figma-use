import { defineRule } from '../core/rule.ts'

interface Options {
  allowInComponents?: boolean
}

export default defineRule({
  meta: {
    id: 'text-style-required',
    category: 'typography',
    description: 'Text layers should use shared text styles for consistency',
    fixable: false,
  },

  match: ['TEXT'],

  check(node, context) {
    const options = context.getConfig<Options>()

    // Skip if text style is already applied
    if (node.textStyleId) return

    // Skip very short text that might be dynamic/placeholder
    if (!node.characters || node.characters.length <= 2) return

    // Optionally allow unstyled text inside components (for dynamic content)
    if (options?.allowInComponents) {
      // Check if any parent is a component
      let parent = node.parent
      while (parent) {
        if ((parent as { type?: string }).type === 'COMPONENT') return
        parent = (parent as { parent?: unknown }).parent
      }
    }

    context.report({
      node,
      message: 'Text layer without text style',
      suggest: `Apply a text style to "${node.characters.slice(0, 30)}${node.characters.length > 30 ? '...' : ''}"`,
    })
  },
})
