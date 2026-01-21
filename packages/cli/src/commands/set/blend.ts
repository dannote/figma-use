import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set blend mode' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    mode: {
      type: 'positional',
      description: 'Blend mode: NORMAL, MULTIPLY, SCREEN, OVERLAY, etc',
      required: true
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-blend-mode', { id: args.id, mode: args.mode })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
