import { defineRule } from '../core/rule.ts'

import type { Effect } from '../core/types.ts'

export default defineRule({
  meta: {
    id: 'effect-style-required',
    category: 'design-tokens',
    description: 'Effects (shadows, blurs) should use shared effect styles',
    fixable: false
  },

  check(node, context) {
    if (!node.effects || node.effects.length === 0) return

    // Skip if all effects are invisible
    const visibleEffects = node.effects.filter((e) => e.visible !== false)
    if (visibleEffects.length === 0) return

    // TODO: Check effectStyleId when we add it to serialization
    // For now, report any node with effects as potentially missing a style

    const effectDescriptions = visibleEffects.map(describeEffect).join(', ')

    context.report({
      node,
      message: `Effect without shared style: ${effectDescriptions}`,
      suggest: 'Create an effect style for consistent shadows and blurs'
    })
  }
})

function describeEffect(effect: Effect): string {
  switch (effect.type) {
    case 'DROP_SHADOW':
      return `Drop shadow ${effect.radius ?? 0}px`
    case 'INNER_SHADOW':
      return `Inner shadow ${effect.radius ?? 0}px`
    case 'LAYER_BLUR':
      return `Layer blur ${effect.radius ?? 0}px`
    case 'BACKGROUND_BLUR':
      return `Background blur ${effect.radius ?? 0}px`
    default:
      return effect.type
  }
}
