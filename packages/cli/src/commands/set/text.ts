import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set text content' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    text: { type: 'positional', description: 'Text content', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-text', { id: args.id, text: args.text })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
