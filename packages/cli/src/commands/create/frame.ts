import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a frame' },
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
    radius: { type: 'string', description: 'Corner radius' },
    opacity: { type: 'string', description: 'Opacity (0-1)' },
    layout: { type: 'string', description: 'Layout mode: HORIZONTAL, VERTICAL, NONE' },
    gap: { type: 'string', description: 'Item spacing (gap)' },
    padding: { type: 'string', description: 'Padding (single value or "top,right,bottom,left")' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let paddingObj
      if (args.padding) {
        const parts = args.padding.split(',').map(Number)
        if (parts.length === 1) {
          const p = parts[0]!
          paddingObj = { top: p, right: p, bottom: p, left: p }
        } else if (parts.length === 4) {
          paddingObj = { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! }
        }
      }

      const result = await sendCommand('create-frame', {
        x: Number(args.x),
        y: Number(args.y),
        width: Number(args.width),
        height: Number(args.height),
        name: args.name,
        parentId: args.parent,
        fill: args.fill,
        stroke: args.stroke,
        strokeWeight: args['stroke-weight'] ? Number(args['stroke-weight']) : undefined,
        radius: args.radius ? Number(args.radius) : undefined,
        opacity: args.opacity ? Number(args.opacity) : undefined,
        layoutMode: args.layout,
        itemSpacing: args.gap ? Number(args.gap) : undefined,
        padding: paddingObj
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
