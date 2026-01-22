import { defineRule } from '../core/rule.ts'

interface Options {
  minChildren?: number
}

export default defineRule({
  meta: {
    id: 'prefer-auto-layout',
    category: 'layout',
    description: 'Frames with multiple children should use Auto Layout for responsive design',
    fixable: false,
  },

  match: ['FRAME', 'COMPONENT'],

  check(node, context) {
    const options = context.getConfig<Options>()
    const minChildren = options?.minChildren ?? 2

    if (node.layoutMode && node.layoutMode !== 'NONE') return
    if (!node.children || node.children.length < minChildren) return

    // Skip if children are absolutely positioned intentionally (e.g., overlapping elements)
    const hasOverlappingChildren = checkForOverlaps(node.children)
    if (hasOverlappingChildren) return

    context.report({
      node,
      message: `Frame with ${node.children.length} children doesn't use Auto Layout`,
      suggest: 'Add Auto Layout (VERTICAL or HORIZONTAL) for better responsiveness',
    })
  },
})

function checkForOverlaps(
  children: Array<{ x?: number; y?: number; width?: number; height?: number }>
): boolean {
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      const a = children[i]
      const b = children[j]

      if (
        a.x === undefined ||
        a.y === undefined ||
        a.width === undefined ||
        a.height === undefined ||
        b.x === undefined ||
        b.y === undefined ||
        b.width === undefined ||
        b.height === undefined
      )
        continue

      const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x
      const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y

      if (overlapsX && overlapsY) return true
    }
  }
  return false
}
