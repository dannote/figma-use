import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a polygon' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    size: { type: 'string', description: 'Size (width/height)', required: true },
    sides: { type: 'string', description: 'Number of sides', default: '6' },
    name: { type: 'string', description: 'Name' },
    parent: { type: 'string', description: 'Parent node ID' },
    fill: { type: 'string', description: 'Fill color (hex)' },
    stroke: { type: 'string', description: 'Stroke color (hex)' },
    'stroke-weight': { type: 'string', description: 'Stroke weight' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-polygon', {
        x: Number(args.x),
        y: Number(args.y),
        size: Number(args.size),
        sides: Number(args.sides),
        name: args.name,
        parentId: args.parent,
        fill: args.fill,
        stroke: args.stroke,
        strokeWeight: args["stroke-weight"] ? Number(args["stroke-weight"]) : undefined
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
