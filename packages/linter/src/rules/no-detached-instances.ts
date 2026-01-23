import { defineRule } from '../core/rule.ts'

interface Options {
  checkNaming?: boolean
  patterns?: string[]
}

const DEFAULT_COMPONENT_PATTERNS = [
  /^(button|btn)/i,
  /^(input|field|text-?field)/i,
  /^(card|modal|dialog)/i,
  /^(icon|avatar|badge)/i,
  /^(nav|menu|tab)/i,
  /^(header|footer|sidebar)/i,
  /^(list|item|row)/i,
  /^(chip|tag|label)/i,
  /^(tooltip|popover|dropdown)/i
]

export default defineRule({
  meta: {
    id: 'no-detached-instances',
    category: 'components',
    description: 'Frames that look like components should be instances, not detached copies',
    fixable: false
  },

  match: ['FRAME'],

  check(node, context) {
    const options = context.getConfig<Options>()

    // Skip if it's already a component or inside a component
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE') return

    // Check if name matches component patterns
    const patterns = options?.patterns?.map((p) => new RegExp(p, 'i')) ?? DEFAULT_COMPONENT_PATTERNS

    const looksLikeComponent = patterns.some((pattern) => pattern.test(node.name))

    if (!looksLikeComponent) return

    // Additional heuristics: has specific structure that suggests it was a component
    const hasComponentLikeStructure =
      node.children && node.children.length > 0 && node.layoutMode && node.layoutMode !== 'NONE'

    if (!hasComponentLikeStructure) return

    context.report({
      node,
      message: `Frame "${node.name}" looks like a component but isn't an instance`,
      suggest: 'Use a component instance instead of a detached frame for consistency'
    })
  }
})
