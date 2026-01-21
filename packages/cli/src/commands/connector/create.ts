import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

function parseMagnet(value: string): { id: string; magnet?: string } {
  const magnets = ['top', 'right', 'bottom', 'left', 'center', 'auto']
  const lower = value.toLowerCase()
  for (const m of magnets) {
    if (lower.endsWith(':' + m)) {
      return { id: value.slice(0, -m.length - 1), magnet: m.toUpperCase() }
    }
  }
  return { id: value }
}

// NOTE: figma.createConnector() only works in FigJam, not in Figma Design files.
// TODO: Implement multiplayer-based creation for Figma Design files.

export default defineCommand({
  meta: { description: 'Create a connector between two nodes' },
  args: {
    from: { type: 'string', required: true, description: 'Start node ID (optionally :magnet)' },
    to: { type: 'string', required: true, description: 'End node ID (optionally :magnet)' },
    type: {
      type: 'string',
      description: 'Line type: straight, elbowed, curved',
      default: 'elbowed'
    },
    'start-cap': {
      type: 'string',
      description: 'Start cap: none, arrow, triangle, diamond, circle'
    },
    'end-cap': {
      type: 'string',
      description: 'End cap: none, arrow, triangle, diamond, circle',
      default: 'arrow'
    },
    stroke: { type: 'string', description: 'Stroke color (hex)' },
    weight: { type: 'string', description: 'Stroke weight' },
    radius: { type: 'string', description: 'Corner radius for elbowed connectors' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const from = parseMagnet(args.from)
      const to = parseMagnet(args.to)

      const result = await sendCommand('create-connector', {
        fromId: from.id,
        fromMagnet: from.magnet,
        toId: to.id,
        toMagnet: to.magnet,
        lineType: args.type?.toUpperCase(),
        startCap: args['start-cap']?.toUpperCase().replace('-', '_'),
        endCap: args['end-cap']?.toUpperCase().replace('-', '_'),
        stroke: args.stroke,
        strokeWeight: args.weight ? Number(args.weight) : undefined,
        cornerRadius: args.radius ? Number(args.radius) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
