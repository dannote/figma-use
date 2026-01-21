import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a line' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    length: { type: 'string', description: 'Length', required: true },
    name: { type: 'string', description: 'Name' },
    parent: { type: 'string', description: 'Parent node ID' },
    stroke: { type: 'string', description: 'Stroke color (hex or var:Name)' },
    'stroke-weight': { type: 'string', description: 'Stroke weight' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-line', {
        x: Number(args.x),
        y: Number(args.y),
        length: Number(args.length),
        name: args.name,
        parentId: args.parent,
        stroke: args.stroke,
        strokeWeight: args['stroke-weight'] ? Number(args['stroke-weight']) : undefined
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
