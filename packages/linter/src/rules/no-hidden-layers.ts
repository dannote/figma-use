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
    id: 'no-hidden-layers',
    category: 'structure',
    description: 'Hidden layers may indicate unused elements that should be deleted',
    fixable: true
  },

  check(node, context) {
    if (node.visible !== false) return

    const options = context.getConfig<Options>()

    // Allow hidden layers in components (often used for variants/states)
    if (options?.allowInComponents !== false) {
      let parent: NodeWithParent | undefined = node.parent as NodeWithParent
      while (parent) {
        if (parent.type === 'COMPONENT' || parent.type === 'COMPONENT_SET') return
        parent = parent.parent
      }
    }

    context.report({
      node,
      message: 'Hidden layer detected',
      suggest: 'Delete if unused, or move to a component if needed for states',
      fix: {
        action: 'set-visible' as 'resize', // Type workaround
        params: { visible: true }
      }
    })
  }
})
