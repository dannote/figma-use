import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Ungroup a group node' },
  args: {
    id: { type: 'string', description: 'Group node ID', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('ungroup-node', { id: args.id }))
    } catch (e) { handleError(e) }
  }
})
