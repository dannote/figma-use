import { defineRule } from '../core/rule.ts'

import type { NodeRef } from '../core/types.ts'

interface Options {
  allowInComponents?: boolean
}

interface NodeWithParent extends NodeRef {
  type?: string
  parent?: NodeWithParent
}

export default defineRule({
  meta: {
    id: 'text-style-required',
    category: 'typography',
    description: 'Text layers should use shared text styles for consistency',
    fixable: false
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
      let parent: NodeWithParent | undefined = node.parent as NodeWithParent
      while (parent) {
        if (parent.type === 'COMPONENT') return
        parent = parent.parent
      }
    }

    context.report({
      node,
      message: 'Text layer without text style',
      suggest: `Apply a text style to "${node.characters.slice(0, 30)}${node.characters.length > 30 ? '...' : ''}"`
    })
  }
})
