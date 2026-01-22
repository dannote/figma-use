import { defineRule } from '../core/rule.ts'
import { rgbToHex } from '../core/utils.ts'
import type { Paint } from '../core/types.ts'

export default defineRule({
  meta: {
    id: 'no-hardcoded-colors',
    category: 'design-tokens',
    description: 'Colors should use variables instead of hardcoded values',
    fixable: true,
  },

  match: ['RECTANGLE', 'ELLIPSE', 'FRAME', 'TEXT', 'VECTOR', 'LINE', 'POLYGON', 'STAR', 'COMPONENT', 'INSTANCE'],

  check(node, context) {
    const checkPaints = (paints: Paint[] | undefined, property: 'fill' | 'stroke') => {
      if (!paints) return

      for (const paint of paints) {
        if (paint.type !== 'SOLID') continue
        if (paint.visible === false) continue
        if (paint.boundVariables?.color) continue
        if (!paint.color) continue

        const hex = rgbToHex(paint.color)
        const similar = context.findSimilarVariable(paint.color, 'COLOR')

        context.report({
          node,
          message: `Hardcoded ${property} color ${hex}`,
          suggest: similar ? `Use variable "${similar.name}"` : undefined,
          fix: similar
            ? {
                action: 'bind-variable',
                params: { variableId: similar.id, field: property === 'fill' ? 'fills' : 'strokes' },
              }
            : undefined,
        })
      }
    }

    checkPaints(node.fills, 'fill')
    checkPaints(node.strokes, 'stroke')
  },
})
