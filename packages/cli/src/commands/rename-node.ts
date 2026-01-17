import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Rename a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    name: { type: 'string', description: 'New name', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('rename-node', { id: args.id, name: args.name }))
    } catch (e) { handleError(e) }
  }
})
