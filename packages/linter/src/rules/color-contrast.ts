import { defineRule } from '../core/rule.ts'
import { contrastRatio, rgbToHex } from '../core/utils.ts'
import type { RGB, FigmaNode, Paint } from '../core/types.ts'

interface Options {
  level?: 'AA' | 'AAA'
  largeTextSize?: number
}

const WCAG_THRESHOLDS = {
  AA: { normal: 4.5, large: 3 },
  AAA: { normal: 7, large: 4.5 },
}

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient color contrast against its background (WCAG)',
    fixable: false,
  },

  match: ['TEXT'],

  check(node, context) {
    const options = context.getConfig<Options>()
    const level = options?.level ?? 'AA'
    const largeTextSize = options?.largeTextSize ?? 18

    const textColor = getTextColor(node)
    if (!textColor) return

    // Try to find background color from parent
    const bgColor = findBackgroundColor(node)
    if (!bgColor) return

    const ratio = contrastRatio(textColor, bgColor)
    const isLargeText = (node.fontSize ?? 16) >= largeTextSize
    const threshold = WCAG_THRESHOLDS[level][isLargeText ? 'large' : 'normal']

    if (ratio < threshold) {
      context.report({
        node,
        message: `Contrast ratio ${ratio.toFixed(2)}:1 is below ${level} threshold (${threshold}:1)`,
        suggest: `Text color: ${rgbToHex(textColor)}, Background: ${rgbToHex(bgColor)}. Increase contrast.`,
      })
    }
  },
})

function getTextColor(node: FigmaNode): RGB | null {
  const fills = node.fills
  if (!fills || fills.length === 0) return null

  const solidFill = fills.find(
    (f): f is Paint & { color: RGB } => f.type === 'SOLID' && f.visible !== false && !!f.color
  )

  return solidFill?.color ?? null
}

function findBackgroundColor(node: FigmaNode): RGB | null {
  let current = node.parent as FigmaNode | undefined

  while (current) {
    if (current.fills) {
      const solidFill = current.fills.find(
        (f): f is Paint & { color: RGB } => f.type === 'SOLID' && f.visible !== false && !!f.color
      )

      if (solidFill?.color) {
        // Apply opacity if present
        const opacity = solidFill.opacity ?? 1
        if (opacity < 1) {
          // Simplified: assume white background behind semi-transparent
          return {
            r: solidFill.color.r * opacity + 1 * (1 - opacity),
            g: solidFill.color.g * opacity + 1 * (1 - opacity),
            b: solidFill.color.b * opacity + 1 * (1 - opacity),
          }
        }
        return solidFill.color
      }
    }

    current = current.parent as FigmaNode | undefined
  }

  // Default to white if no background found
  return { r: 1, g: 1, b: 1 }
}
