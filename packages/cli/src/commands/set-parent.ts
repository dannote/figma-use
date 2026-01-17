import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set parent of a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    parentId: { type: 'string', description: 'Parent node ID', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-parent-id', {
          id: args.id,
          parentId: args.parentId
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
