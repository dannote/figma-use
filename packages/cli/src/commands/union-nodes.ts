import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Union nodes (boolean operation)' },
  args: {
    ids: { type: 'string', description: 'Comma-separated node IDs', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('boolean-operation', {
        ids: args.ids.split(',').map(s => s.trim()),
        operation: 'UNION'
      }))
    } catch (e) { handleError(e) }
  }
})
