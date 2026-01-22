import { defineRule } from '../core/rule.ts'

interface Options {
  minSize?: number
}

const INTERACTIVE_PATTERNS = [
  /button/i,
  /btn/i,
  /link/i,
  /cta/i,
  /icon/i,
  /checkbox/i,
  /radio/i,
  /switch/i,
  /toggle/i,
  /input/i,
  /select/i,
  /dropdown/i,
  /menu/i,
  /tab/i,
  /chip/i,
  /tag/i,
  /close/i,
  /dismiss/i,
  /action/i,
  /clickable/i,
  /tappable/i,
]

export default defineRule({
  meta: {
    id: 'touch-target-size',
    category: 'accessibility',
    description: 'Interactive elements should be at least 44x44px for touch accessibility',
    fixable: true,
  },

  match: ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE'],

  check(node, context) {
    const options = context.getConfig<Options>()
    const minSize = options?.minSize ?? 44

    // Only check elements that look interactive
    if (!isLikelyInteractive(node.name, node.type)) return

    const width = node.width ?? 0
    const height = node.height ?? 0

    if (width >= minSize && height >= minSize) return

    const issues: string[] = []
    if (width < minSize) issues.push(`width ${width}px`)
    if (height < minSize) issues.push(`height ${height}px`)

    context.report({
      node,
      message: `Touch target too small: ${issues.join(', ')} (minimum ${minSize}px)`,
      suggest: `Resize to at least ${minSize}x${minSize}px or add padding`,
      fix: {
        action: 'resize',
        params: {
          width: Math.max(width, minSize),
          height: Math.max(height, minSize),
        },
      },
    })
  },
})

function isLikelyInteractive(name: string, type: string): boolean {
  // Components and instances are often interactive
  if (type === 'COMPONENT' || type === 'INSTANCE') {
    return INTERACTIVE_PATTERNS.some(pattern => pattern.test(name))
  }

  // Check name for interactive patterns
  return INTERACTIVE_PATTERNS.some(pattern => pattern.test(name))
}
