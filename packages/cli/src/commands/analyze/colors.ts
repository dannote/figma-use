import { defineCommand } from 'citty'
import { sendCommand } from '../../client.ts'

interface ColorInfo {
  hex: string
  count: number
  nodes: string[]
  isVariable: boolean
  isStyle: boolean
}

interface ColorCluster {
  colors: ColorInfo[]
  suggestedHex: string
  totalCount: number
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function clusterColors(colors: ColorInfo[], threshold: number): ColorCluster[] {
  const clusters: ColorCluster[] = []
  const used = new Set<string>()

  const sorted = [...colors].sort((a, b) => b.count - a.count)

  for (const color of sorted) {
    if (used.has(color.hex)) continue

    const cluster: ColorCluster = {
      colors: [color],
      suggestedHex: color.hex,
      totalCount: color.count,
    }
    used.add(color.hex)

    for (const other of sorted) {
      if (used.has(other.hex)) continue
      if (colorDistance(color.hex, other.hex) <= threshold) {
        cluster.colors.push(other)
        cluster.totalCount += other.count
        used.add(other.hex)
      }
    }

    if (cluster.colors.length > 1) {
      clusters.push(cluster)
    }
  }

  return clusters.sort((a, b) => b.colors.length - a.colors.length)
}

export default defineCommand({
  meta: { description: 'Analyze color palette usage' },
  args: {
    limit: { type: 'string', description: 'Max colors to show', default: '30' },
    threshold: { type: 'string', description: 'Distance threshold for clustering (0-50)', default: '15' },
    'show-similar': { type: 'boolean', description: 'Show similar color clusters' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const limit = Number(args.limit)
    const threshold = Number(args.threshold)

    const result = (await sendCommand('analyze-colors', {})) as {
      colors: ColorInfo[]
      totalNodes: number
    }

    if (args.json) {
      const clusters = args['show-similar'] ? clusterColors(result.colors, threshold) : []
      console.log(JSON.stringify({ ...result, clusters }, null, 2))
      return
    }

    if (result.colors.length === 0) {
      console.log('No colors found')
      return
    }

    const sorted = result.colors.sort((a, b) => b.count - a.count).slice(0, limit)

    console.log('Colors by usage:\n')

    for (const color of sorted) {
      const bar = '█'.repeat(Math.min(Math.ceil(color.count / 10), 30))
      const tags: string[] = []
      if (color.isVariable) tags.push('var')
      if (color.isStyle) tags.push('style')
      const tagStr = tags.length ? ` (${tags.join(', ')})` : ''
      console.log(`${color.hex}  ${bar} ${color.count}×${tagStr}`)
    }

    const hardcoded = result.colors.filter((c) => !c.isVariable && !c.isStyle)
    const fromVars = result.colors.filter((c) => c.isVariable)
    const fromStyles = result.colors.filter((c) => c.isStyle)

    console.log()
    console.log(`${result.colors.length} unique colors from ${result.totalNodes} nodes`)
    console.log(`  ${fromVars.length} from variables, ${fromStyles.length} from styles, ${hardcoded.length} hardcoded`)

    if (args['show-similar']) {
      const clusters = clusterColors(hardcoded, threshold)
      if (clusters.length > 0) {
        console.log('\nSimilar colors (consider merging):\n')
        for (const cluster of clusters.slice(0, 10)) {
          const hexes = cluster.colors.map((c) => c.hex).join(', ')
          console.log(`  ${hexes}`)
          console.log(`  → suggest: ${cluster.suggestedHex} (${cluster.totalCount}× total)`)
          console.log()
        }
      }
    }
  },
})
