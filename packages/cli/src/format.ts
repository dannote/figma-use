import { ok, fail, dim, bold, green, cyan, box as fmtBox } from 'agentfmt'

import type { FigmaNode, FigmaPaint } from './types.ts'

// Re-export from agentfmt
export { ok, fail, dim, bold }
export const success = green
export const accent = cyan

// Figma type labels
export const TYPE_LABELS: Record<string, string> = {
  FRAME: 'frame',
  RECTANGLE: 'rect',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
  COMPONENT: 'component',
  INSTANCE: 'instance',
  GROUP: 'group',
  VECTOR: 'vector',
  LINE: 'line',
  POLYGON: 'polygon',
  STAR: 'star',
  BOOLEAN_OPERATION: 'boolean',
  SECTION: 'section',
  SLICE: 'slice',
  PAGE: 'page'
}

export function formatType(type: string): string {
  return TYPE_LABELS[type] || type.toLowerCase()
}

// Figma color/paint formatting
export function formatColor(paint: FigmaPaint): string {
  if (paint.type === 'SOLID' && paint.color) {
    const alpha =
      paint.opacity !== undefined && paint.opacity < 1
        ? Math.round(paint.opacity * 255)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase()
        : ''
    return paint.color + alpha
  }
  return paint.type.toLowerCase()
}

export function formatFill(fills?: FigmaPaint[]): string | null {
  if (!fills || fills.length === 0) return null
  const solid = fills.find((f) => f.type === 'SOLID')
  return solid ? formatColor(solid) : null
}

export function formatStroke(strokes?: FigmaPaint[], weight?: number): string | null {
  if (!strokes || strokes.length === 0) return null
  const solid = strokes.find((f) => f.type === 'SOLID')
  if (!solid?.color) return null
  const color = formatColor(solid)
  return weight ? `${color} ${weight}px` : color
}

// Box formatting (delegates to agentfmt)
export function formatBox(node: {
  width?: number
  height?: number
  x?: number
  y?: number
}): string | null {
  if (node.width === undefined || node.height === undefined) return null
  return fmtBox(node.width, node.height, node.x, node.y)
}

// Figma-specific formatters
export function formatLayout(node: FigmaNode): string | null {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null
  const dir = node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'
  const gap = node.itemSpacing ? ` gap=${node.itemSpacing}` : ''
  return `layout: ${dir}${gap}`
}

export function formatText(characters?: string, maxLen = 40): string | null {
  if (!characters) return null
  const text = characters.length > maxLen ? characters.slice(0, maxLen) + '…' : characters
  return `"${text.replace(/\n/g, '↵')}"`
}

export function formatFont(node: FigmaNode): string | null {
  if (!node.fontSize) return null
  const family = node.fontFamily || ''
  const style = node.fontStyle && node.fontStyle !== 'Regular' ? ` ${node.fontStyle}` : ''
  return `font: ${node.fontSize}px${family ? ` ${family}${style}` : ''}`
}

export function installHint(pkg: string): string {
  const ua = process.env.npm_config_user_agent
  if (ua?.startsWith('bun')) return `bun add -d ${pkg}`
  if (ua?.startsWith('pnpm')) return `pnpm add -D ${pkg}`
  if (ua?.startsWith('yarn')) return `yarn add -D ${pkg}`
  return `npm install -D ${pkg}`
}
