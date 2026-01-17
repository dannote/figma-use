import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Clone a node' },
  args: {
    id: { type: 'string', description: 'Node ID to clone', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('clone-node', { id: args.id }))
    } catch (e) {
      handleError(e)
    }
  }
})
