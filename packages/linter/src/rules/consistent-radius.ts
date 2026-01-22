import { defineRule } from '../core/rule.ts'

interface Options {
  allowedValues?: number[]
}

const DEFAULT_RADIUS_SCALE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 9999]

export default defineRule({
  meta: {
    id: 'consistent-radius',
    category: 'design-tokens',
    description: 'Corner radius should use values from the design system scale',
    fixable: true,
  },

  match: ['RECTANGLE', 'FRAME', 'COMPONENT', 'INSTANCE'],

  check(node, context) {
    if (node.cornerRadius === undefined || node.cornerRadius === 0) return

    const options = context.getConfig<Options>()
    const allowedValues = options?.allowedValues ?? DEFAULT_RADIUS_SCALE

    if (allowedValues.includes(node.cornerRadius)) return

    const closest = allowedValues.reduce((prev, curr) =>
      Math.abs(curr - node.cornerRadius!) < Math.abs(prev - node.cornerRadius!) ? curr : prev
    )

    context.report({
      node,
      message: `Corner radius ${node.cornerRadius}px is not in scale`,
      suggest: `Use ${closest}px instead`,
      fix: {
        action: 'set-layout' as 'resize',
        params: { radius: closest },
      },
    })
  },
})
