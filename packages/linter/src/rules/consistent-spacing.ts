import { defineRule } from '../core/rule.ts'
import { isMultipleOf, SPACING_SCALE } from '../core/utils.ts'

interface Options {
  base?: number
  allowedValues?: number[]
  checkGap?: boolean
  checkPadding?: boolean
}

export default defineRule({
  meta: {
    id: 'consistent-spacing',
    category: 'layout',
    description: 'Spacing values should follow the spacing scale (multiples of base unit)',
    fixable: true,
  },

  match: ['FRAME', 'COMPONENT'],

  check(node, context) {
    const options = context.getConfig<Options>()
    const base = options?.base ?? 8
    const allowedValues = options?.allowedValues ?? SPACING_SCALE
    const checkGap = options?.checkGap ?? true
    const checkPadding = options?.checkPadding ?? true

    if (!node.layoutMode || node.layoutMode === 'NONE') return

    const isValidSpacing = (value: number): boolean => {
      if (allowedValues.includes(value)) return true
      return isMultipleOf(value, base)
    }

    const findClosestValid = (value: number): number => {
      return allowedValues.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
      )
    }

    if (checkGap && node.itemSpacing !== undefined && !isValidSpacing(node.itemSpacing)) {
      const closest = findClosestValid(node.itemSpacing)
      context.report({
        node,
        message: `Gap ${node.itemSpacing}px is not in spacing scale`,
        suggest: `Use ${closest}px instead`,
        fix: {
          action: 'set-layout',
          params: { gap: closest },
        },
      })
    }

    const paddings = [
      { name: 'paddingTop', value: node.paddingTop },
      { name: 'paddingRight', value: node.paddingRight },
      { name: 'paddingBottom', value: node.paddingBottom },
      { name: 'paddingLeft', value: node.paddingLeft },
    ]

    if (checkPadding) {
      for (const { name, value } of paddings) {
        if (value === undefined || isValidSpacing(value)) continue

        const closest = findClosestValid(value)
        context.report({
          node,
          message: `${name} ${value}px is not in spacing scale`,
          suggest: `Use ${closest}px instead`,
        })
      }
    }
  },
})
