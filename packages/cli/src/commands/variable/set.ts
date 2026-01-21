import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set variable value for mode' },
  args: {
    id: { type: 'positional', description: 'Variable ID', required: true },
    mode: { type: 'string', description: 'Mode ID', required: true },
    value: {
      type: 'string',
      description: 'Value (color hex, number, string, or true/false)',
      required: true
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-variable-value', {
        id: args.id,
        modeId: args.mode,
        value: args.value
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
