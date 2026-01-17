import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set stroke color of a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'string', description: 'Color (hex, e.g. #0000FFFF)', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-stroke-color', {
          id: args.id,
          color: args.color
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
