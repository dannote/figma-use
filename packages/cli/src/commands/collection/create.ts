import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a variable collection' },
  args: {
    name: { type: 'positional', description: 'Collection name', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-variable-collection', { name: args.name })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
