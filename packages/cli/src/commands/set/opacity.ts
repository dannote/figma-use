import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set opacity' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    value: { type: 'positional', description: 'Opacity (0-1)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-opacity', { id: args.id, opacity: Number(args.value) })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
