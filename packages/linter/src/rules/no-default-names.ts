import { defineRule } from '../core/rule.ts'
import { isDefaultName } from '../core/utils.ts'

export default defineRule({
  meta: {
    id: 'no-default-names',
    category: 'naming',
    description: 'Layers should have descriptive names, not default Figma names',
    fixable: false,
  },

  check(node, context) {
    if (!isDefaultName(node.name)) return

    // Skip if it's a very simple shape that might be intentionally unnamed
    // (like a small decorative element)
    const isSmallDecorative =
      (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'LINE') &&
      node.width !== undefined &&
      node.height !== undefined &&
      node.width < 24 &&
      node.height < 24

    if (isSmallDecorative) return

    context.report({
      node,
      message: `Default layer name "${node.name}" is not descriptive`,
      suggest: 'Rename to describe the layer\'s purpose (e.g., "header-background", "submit-button")',
    })
  },
})
