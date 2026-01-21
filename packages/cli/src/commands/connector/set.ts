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

export default defineCommand({
  meta: { description: 'Update connector properties' },
  args: {
    id: { type: 'positional', required: true, description: 'Connector ID' },
    from: { type: 'string', description: 'New start node ID (optionally :magnet)' },
    to: { type: 'string', description: 'New end node ID (optionally :magnet)' },
    type: { type: 'string', description: 'Line type: straight, elbowed, curved' },
    'start-cap': {
      type: 'string',
      description: 'Start cap: none, arrow, triangle, diamond, circle'
    },
    'end-cap': { type: 'string', description: 'End cap: none, arrow, triangle, diamond, circle' },
    stroke: { type: 'string', description: 'Stroke color (hex)' },
    weight: { type: 'string', description: 'Stroke weight' },
    radius: { type: 'string', description: 'Corner radius' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const from = args.from ? parseMagnet(args.from) : undefined
      const to = args.to ? parseMagnet(args.to) : undefined

      const result = await sendCommand('set-connector', {
        id: args.id,
        fromId: from?.id,
        fromMagnet: from?.magnet,
        toId: to?.id,
        toMagnet: to?.magnet,
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
