import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Group nodes together' },
  args: {
    ids: { type: 'string', description: 'Comma-separated node IDs', required: true },
    name: { type: 'string', description: 'Group name' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('group-nodes', {
        ids: args.ids.split(',').map(s => s.trim()),
        name: args.name
      }))
    } catch (e) { handleError(e) }
  }
})
