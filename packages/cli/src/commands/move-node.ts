import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Move a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('move-node', {
          id: args.id,
          x: Number(args.x),
          y: Number(args.y)
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
