import { defineRule } from '../core/rule.ts'

export default defineRule({
  meta: {
    id: 'no-empty-frames',
    category: 'structure',
    description: 'Frames should not be empty unless used as spacers',
    fixable: false,
  },

  match: ['FRAME'],

  check(node, context) {
    if (!node.children || node.children.length > 0) return

    // Skip if it's likely a spacer (small, no fill, in auto layout)
    const isLikelySpacer =
      node.name.toLowerCase().includes('spacer') ||
      (node.width !== undefined &&
        node.height !== undefined &&
        (node.width <= 1 || node.height <= 1))

    if (isLikelySpacer) return

    // Skip if has a visible fill (could be a colored box)
    const hasVisibleFill = node.fills?.some(
      f => f.visible !== false && f.type === 'SOLID'
    )

    if (hasVisibleFill) return

    context.report({
      node,
      message: 'Empty frame with no fill',
      suggest: 'Delete if unused, or add content/fill',
    })
  },
})
