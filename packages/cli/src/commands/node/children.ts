import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get child nodes' },
  args: {
    id: { type: 'positional', description: 'Parent node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('get-children', { id: args.id })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
