import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a star' },
  args: {
    x: { type: 'string', description: 'X position', required: true },
    y: { type: 'string', description: 'Y position', required: true },
    size: { type: 'string', description: 'Size', required: true },
    points: { type: 'string', description: 'Number of points', default: '5' },
    innerRadius: { type: 'string', description: 'Inner radius ratio (0-1)', default: '0.5' },
    name: { type: 'string', description: 'Node name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-star', {
        x: Number(args.x),
        y: Number(args.y),
        size: Number(args.size),
        points: Number(args.points),
        innerRadius: Number(args.innerRadius),
        name: args.name,
        parentId: args.parentId
      }))
    } catch (e) { handleError(e) }
  }
})
