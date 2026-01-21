import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Delete a variable' },
  args: {
    id: { type: 'positional', description: 'Variable ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('delete-variable', { id: args.id })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
