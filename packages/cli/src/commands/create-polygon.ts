import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a polygon' },
  args: {
    x: { type: 'string', description: 'X position', required: true },
    y: { type: 'string', description: 'Y position', required: true },
    size: { type: 'string', description: 'Size', required: true },
    sides: { type: 'string', description: 'Number of sides', default: '3' },
    name: { type: 'string', description: 'Node name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-polygon', {
        x: Number(args.x),
        y: Number(args.y),
        size: Number(args.size),
        sides: Number(args.sides),
        name: args.name,
        parentId: args.parentId
      }))
    } catch (e) { handleError(e) }
  }
})
