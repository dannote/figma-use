import type { RGB } from './types.ts'

export function rgbToHex(rgb: RGB): string {
  const r = Math.round(rgb.r * 255)
  const g = Math.round(rgb.g * 255)
  const b = Math.round(rgb.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) throw new Error(`Invalid hex color: ${hex}`)
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

export function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  )
}

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate contrast ratio per WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
export function contrastRatio(foreground: RGB, background: RGB): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if value is multiple of base (with tolerance for floating point)
 */
export function isMultipleOf(value: number, base: number, tolerance = 0.01): boolean {
  if (base === 0) return false
  const remainder = value % base
  return remainder < tolerance || (base - remainder) < tolerance
}

/**
 * Get node path as array of names
 */
export function getNodePath(node: { name: string; parent?: { name: string; parent?: unknown } }): string[] {
  const path: string[] = []
  let current: typeof node | undefined = node
  while (current) {
    path.unshift(current.name)
    current = current.parent as typeof node | undefined
  }
  return path
}

/**
 * Check if name matches default Figma naming pattern
 */
export function isDefaultName(name: string): boolean {
  return /^(Frame|Rectangle|Ellipse|Line|Text|Group|Vector|Polygon|Star|Section|Component|Instance|Slice)\s*\d*$/i.test(name)
}

/**
 * Common spacing values in 8pt grid system
 */
export const SPACING_SCALE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128]

/**
 * Common font size scale
 */
export const FONT_SIZE_SCALE = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72]
