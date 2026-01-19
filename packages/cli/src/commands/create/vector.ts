import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a vector path' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    path: { type: 'string', description: 'SVG path data', required: true },
    name: { type: 'string', description: 'Name' },
    parent: { type: 'string', description: 'Parent node ID' },
    fill: { type: 'string', description: 'Fill color (hex)' },
    stroke: { type: 'string', description: 'Stroke color (hex)' },
    'stroke-weight': { type: 'string', description: 'Stroke weight' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-vector', {
        x: Number(args.x),
        y: Number(args.y),
        path: args.path,
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
