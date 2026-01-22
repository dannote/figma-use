import { defineRule } from '../core/rule.ts'

export default defineRule({
  meta: {
    id: 'no-mixed-styles',
    category: 'typography',
    description: 'Text layers should not have mixed font styles (different fonts/sizes in one layer)',
    fixable: false,
  },

  match: ['TEXT'],

  check(node, context) {
    // In Figma, when a text layer has mixed styles, fontSize/fontName become symbols
    // We detect this by checking if fontSize is undefined when characters exist

    if (!node.characters || node.characters.length === 0) return

    // If we have text but no fontSize, it's likely mixed
    // (Our serialization sets fontSize only when it's a single number)
    if (node.fontSize === undefined && node.characters.length > 1) {
      context.report({
        node,
        message: 'Text layer has mixed font styles',
        suggest: 'Split into separate text layers or unify the text style',
      })
    }
  },
})
