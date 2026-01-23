import { defineCommand } from 'citty'

import { sendCommand } from '../../client.ts'

interface ClusterNode {
  id: string
  name: string
  width: number
  height: number
  childCount: number
  type: string
}

interface Cluster {
  signature: string
  nodes: ClusterNode[]
  avgWidth: number
  avgHeight: number
  widthRange: number
  heightRange: number
  confidence: number
}

function calcConfidence(nodes: ClusterNode[]): number {
  if (nodes.length < 2) return 100

  const base = nodes[0]!
  let score = 0

  for (const node of nodes.slice(1)) {
    const sizeDiff = Math.abs(node.width - base.width) + Math.abs(node.height - base.height)
    const childDiff = Math.abs(node.childCount - base.childCount)

    if (sizeDiff <= 4 && childDiff === 0) score++
    else if (sizeDiff <= 10 && childDiff <= 1) score += 0.8
    else if (sizeDiff <= 20 && childDiff <= 2) score += 0.6
    else score += 0.4
  }

  return Math.round((score / (nodes.length - 1)) * 100)
}

function formatSignature(sig: string): string {
  // "FRAME:200x40|TEXT:1,FRAME:1" -> "Frame > [Text, Frame]"
  const [typeSize, children] = sig.split('|')
  const type = typeSize?.split(':')[0]

  if (!type) return sig
  if (!children) return type.charAt(0) + type.slice(1).toLowerCase()

  const childParts = children.split(',').map((c) => {
    const [t, count] = c.split(':')
    if (!t) return ''
    const name = t.charAt(0) + t.slice(1).toLowerCase()
    return Number(count) > 1 ? `${name}×${count}` : name
  })

  return `${type.charAt(0) + type.slice(1).toLowerCase()} > [${childParts.join(', ')}]`
}

export default defineCommand({
  meta: { description: 'Find repeated design patterns (potential components)' },
  args: {
    limit: { type: 'string', description: 'Max clusters to show', default: '20' },
    'min-size': { type: 'string', description: 'Min node size in px', default: '30' },
    'min-count': { type: 'string', description: 'Min instances to form cluster', default: '2' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const minSize = Number(args['min-size'])
    const minCount = Number(args['min-count'])
    const limit = Number(args.limit)

    const result = (await sendCommand('analyze-clusters', {
      minSize,
      minCount,
      limit
    })) as { clusters: Cluster[]; totalNodes: number }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    if (result.clusters.length === 0) {
      console.log('No repeated patterns found')
      return
    }

    for (let i = 0; i < result.clusters.length; i++) {
      const c = result.clusters[i]!
      const confidence = calcConfidence(c.nodes)
      const firstNode = c.nodes[0]!
      const typeLower = firstNode.type.toLowerCase()

      // Size range
      const sizeStr =
        c.widthRange <= 4 && c.heightRange <= 4
          ? `${Math.round(c.avgWidth)}×${Math.round(c.avgHeight)}`
          : `${Math.round(c.avgWidth)}×${Math.round(c.avgHeight)} (±${Math.max(c.widthRange, c.heightRange)}px)`

      console.log(
        `[${i}] ${c.nodes.length}× ${typeLower} "${firstNode.name}" pattern (${confidence}% match)`
      )
      console.log(`    ${sizeStr} | ${formatSignature(c.signature)}`)
      console.log(
        `    examples: ${c.nodes
          .slice(0, 3)
          .map((n) => n.id)
          .join(', ')}`
      )
      console.log()
    }

    const clusteredNodes = result.clusters.reduce((sum, c) => sum + c.nodes.length, 0)
    console.log(
      `${result.clusters.length} clusters from ${result.totalNodes} nodes (${clusteredNodes} clustered)`
    )
  }
})
