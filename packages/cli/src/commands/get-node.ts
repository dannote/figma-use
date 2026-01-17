import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get node info' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('get-node-info', { id: args.id }))
    } catch (e) {
      handleError(e)
    }
  }
})
