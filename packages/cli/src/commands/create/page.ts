import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a page' },
  args: {
    name: { type: 'positional', description: 'Page name', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-page', { name: args.name })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
