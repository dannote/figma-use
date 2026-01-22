import { defineRule } from '../core/rule.ts'

interface Options {
  allowInComponents?: boolean
}

export default defineRule({
  meta: {
    id: 'no-hidden-layers',
    category: 'structure',
    description: 'Hidden layers may indicate unused elements that should be deleted',
    fixable: true,
  },

  check(node, context) {
    if (node.visible !== false) return

    const options = context.getConfig<Options>()

    // Allow hidden layers in components (often used for variants/states)
    if (options?.allowInComponents !== false) {
      let parent = node.parent
      while (parent) {
        const parentType = (parent as { type?: string }).type
        if (parentType === 'COMPONENT' || parentType === 'COMPONENT_SET') return
        parent = (parent as { parent?: unknown }).parent
      }
    }

    context.report({
      node,
      message: 'Hidden layer detected',
      suggest: 'Delete if unused, or move to a component if needed for states',
      fix: {
        action: 'set-visible' as 'resize', // Type workaround
        params: { visible: true },
      },
    })
  },
})
