import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a rectangle' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    width: { type: 'string', description: 'Width', required: true },
    height: { type: 'string', description: 'Height', required: true },
    name: { type: 'string', description: 'Name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('create-rectangle', {
          x: Number(args.x),
          y: Number(args.y),
          width: Number(args.width),
          height: Number(args.height),
          name: args.name,
          parentId: args.parentId
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
