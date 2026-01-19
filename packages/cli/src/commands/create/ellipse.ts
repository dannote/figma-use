import { defineCommand } from 'citty'
import { colorArgToPayload } from '../../color-arg.ts'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create an ellipse' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    width: { type: 'string', description: 'Width', required: true },
    height: { type: 'string', description: 'Height', required: true },
    name: { type: 'string', description: 'Name' },
    parent: { type: 'string', description: 'Parent node ID' },
    fill: { type: 'string', description: 'Fill color (hex or var:Name)' },
    stroke: { type: 'string', description: 'Stroke color (hex or var:Name)' },
    'stroke-weight': { type: 'string', description: 'Stroke weight' },
    opacity: { type: 'string', description: 'Opacity (0-1)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-ellipse', {
        x: Number(args.x),
        y: Number(args.y),
        width: Number(args.width),
        height: Number(args.height),
        name: args.name,
        parentId: args.parent,
        fill: colorArgToPayload(args.fill),
        stroke: colorArgToPayload(args.stroke),
        strokeWeight: args["stroke-weight"] ? Number(args["stroke-weight"]) : undefined,
        opacity: args.opacity ? Number(args.opacity) : undefined
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
