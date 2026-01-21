import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Ungroup nodes' },
  args: {
    id: { type: 'positional', description: 'Group node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('ungroup-node', { id: args.id })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
