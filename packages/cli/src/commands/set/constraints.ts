import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set resize constraints' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    horizontal: { type: 'string', description: 'Horizontal: MIN, CENTER, MAX, STRETCH, SCALE' },
    vertical: { type: 'string', description: 'Vertical: MIN, CENTER, MAX, STRETCH, SCALE' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-constraints', {
        id: args.id,
        horizontal: args.horizontal,
        vertical: args.vertical
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
