import { sendCommand } from './client.ts'
import { installHint } from './format.ts'

import type { FigmaNode } from './types.ts'

const SVG_TYPES = new Set(['VECTOR', 'STAR', 'POLYGON', 'LINE'])
const ICONIFY_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/i

interface IconMatch {
  name: string
  similarity: number
}

let whaticon: typeof import('whaticon') | null = null
let iconIndex: Awaited<ReturnType<typeof import('whaticon')['loadIndex']>> | null = null

async function getWhaticon() {
  if (!whaticon) {
    try {
      whaticon = await import('whaticon')
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
        console.error(`whaticon is required for icon matching. Install it:\n\n  ${installHint('whaticon')}\n`)
        process.exit(1)
      }
      throw e
    }
  }
  return whaticon
}

async function ensureIndex() {
  if (iconIndex) return iconIndex

  const wi = await getWhaticon()
  const { ensureIndex: ensure, loadIndex } = wi as typeof import('whaticon') & {
    ensureIndex: typeof import('whaticon/download')['ensureIndex']
  }

  // Dynamic import for download module
  let ensureFn = ensure
  if (!ensureFn) {
    const download = await import('whaticon/download')
    ensureFn = download.ensureIndex
  }

  const { namesGz, hashesGz } = await ensureFn('popular', (msg) => {
    if (msg.startsWith('Downloading')) {
      console.error(msg)
    }
  })

  iconIndex = loadIndex(namesGz, hashesGz)
  return iconIndex
}

export async function matchIcon(
  svg: string,
  options: { threshold?: number; prefer?: string[] } = {}
): Promise<IconMatch | null> {
  const wi = await getWhaticon()
  const index = await ensureIndex()

  const matches = await wi.findMatches(svg, index, {
    limit: 1,
    threshold: options.threshold ?? 0.9,
    prefer: options.prefer
  })

  return matches[0] ?? null
}

function isLikelyIcon(node: FigmaNode): boolean {
  // Already has iconify name
  if (node.name && ICONIFY_PATTERN.test(node.name)) return false

  // Is SVG type
  if (!SVG_TYPES.has(node.type)) return false

  // Reasonable icon size (4-128px)
  const w = node.width ?? 0
  const h = node.height ?? 0
  if (w < 4 || w > 128 || h < 4 || h > 128) return false

  // Roughly square (allow some stretch for lock icons etc)
  const ratio = Math.max(w, h) / Math.min(w, h)
  if (ratio > 2) return false

  return true
}

export async function matchIconsInTree(
  node: FigmaNode,
  options: {
    threshold?: number
    prefer?: string[]
    onMatch?: (node: FigmaNode, match: IconMatch) => void
  } = {}
): Promise<number> {
  let matchCount = 0

  async function processNode(n: FigmaNode): Promise<void> {
    if (isLikelyIcon(n)) {
      try {
        // Use existing svgData if available, otherwise fetch
        let svg = n.svgData
        if (!svg) {
          const result = await sendCommand<{ svg: string }>('export-node-svg', { id: n.id })
          svg = result?.svg
        }
        if (svg) {
          const match = await matchIcon(svg, {
            threshold: options.threshold,
            prefer: options.prefer
          })
          if (match) {
            n.matchedIcon = match.name
            n.matchedIconSimilarity = match.similarity
            matchCount++
            options.onMatch?.(n, match)
          }
        }
      } catch {
        // Ignore export errors
      }
    }

    if (n.children) {
      for (const child of n.children) {
        await processNode(child)
      }
    }
  }

  await processNode(node)
  return matchCount
}
