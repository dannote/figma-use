import { defineRule } from '../core/rule.ts'

interface Options {
  checkPosition?: boolean
  checkSize?: boolean
  tolerance?: number
}

export default defineRule({
  meta: {
    id: 'pixel-perfect',
    category: 'layout',
    description: 'Elements should be aligned to whole pixels (no subpixel values)',
    fixable: true,
  },

  check(node, context) {
    const options = context.getConfig<Options>()
    const checkPosition = options?.checkPosition ?? true
    const checkSize = options?.checkSize ?? true
    const tolerance = options?.tolerance ?? 0.01

    const issues: string[] = []

    const isWholePixel = (value: number): boolean =>
      Math.abs(value - Math.round(value)) < tolerance

    if (checkPosition) {
      if (node.x !== undefined && !isWholePixel(node.x)) {
        issues.push(`x: ${node.x}`)
      }
      if (node.y !== undefined && !isWholePixel(node.y)) {
        issues.push(`y: ${node.y}`)
      }
    }

    if (checkSize) {
      if (node.width !== undefined && !isWholePixel(node.width)) {
        issues.push(`width: ${node.width}`)
      }
      if (node.height !== undefined && !isWholePixel(node.height)) {
        issues.push(`height: ${node.height}`)
      }
    }

    if (issues.length === 0) return

    context.report({
      node,
      message: `Subpixel values: ${issues.join(', ')}`,
      suggest: 'Round to whole pixels for crisp rendering',
      fix: {
        action: 'resize',
        params: {
          x: node.x !== undefined ? Math.round(node.x) : undefined,
          y: node.y !== undefined ? Math.round(node.y) : undefined,
          width: node.width !== undefined ? Math.round(node.width) : undefined,
          height: node.height !== undefined ? Math.round(node.height) : undefined,
        },
      },
    })
  },
})
