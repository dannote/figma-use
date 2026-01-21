import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set locked state' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    value: { type: 'positional', description: 'true or false', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-locked', { id: args.id, locked: args.value === 'true' })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
