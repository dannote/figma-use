import { sendCommand } from './client.ts'

import type { FigmaNode, FigmaViewport } from './types.ts'

const MAX_PIXELS = 4096 * 4096
const MAX_DIMENSION = 4096

function checkDimensions(
  width: number,
  height: number,
  context: string
): { ok: boolean; message?: string } {
  const pixels = width * height

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      ok: false,
      message: `${context} ${width}×${height} exceeds max dimension ${MAX_DIMENSION}px. Use --force to override.`
    }
  }

  if (pixels > MAX_PIXELS) {
    const megapixels = (pixels / 1_000_000).toFixed(1)
    const maxMp = (MAX_PIXELS / 1_000_000).toFixed(0)
    return {
      ok: false,
      message: `${context} ${width}×${height} (${megapixels}MP) exceeds ${maxMp}MP limit. Use --force to override.`
    }
  }

  return { ok: true }
}

export async function checkExportSize(
  id: string,
  scale: number,
  force: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (force) return { ok: true }

  const node = (await sendCommand('get-node-info', { id })) as FigmaNode | null
  if (!node || !node.width || !node.height) return { ok: true }

  const width = Math.round(node.width * scale)
  const height = Math.round(node.height * scale)

  return checkDimensions(width, height, 'Export size')
}

export async function checkViewportSize(
  scale: number,
  force: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (force) return { ok: true }

  const viewport = (await sendCommand('get-viewport', {})) as FigmaViewport
  const width = Math.round(viewport.bounds.width * scale)
  const height = Math.round(viewport.bounds.height * scale)

  return checkDimensions(width, height, 'Viewport')
}

export async function checkSelectionSize(
  scale: number,
  padding: number,
  force: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (force) return { ok: true }

  const selection = (await sendCommand('get-selection', {})) as FigmaNode[]
  if (selection.length === 0) return { ok: true }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const node of selection) {
    if (node.width && node.height) {
      const x = node.x || 0
      const y = node.y || 0
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + node.width)
      maxY = Math.max(maxY, y + node.height)
    }
  }

  if (minX === Infinity) return { ok: true }

  const width = Math.round((maxX - minX + padding * 2) * scale)
  const height = Math.round((maxY - minY + padding * 2) * scale)

  return checkDimensions(width, height, 'Selection')
}
