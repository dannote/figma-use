import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Resize a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    width: { type: 'string', description: 'Width', required: true },
    height: { type: 'string', description: 'Height', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('resize-node', {
          id: args.id,
          width: Number(args.width),
          height: Number(args.height)
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
