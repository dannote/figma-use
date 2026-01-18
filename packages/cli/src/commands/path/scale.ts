import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Scale path from center' },
  args: {
    id: { type: 'positional', description: 'Vector node ID', required: true },
    factor: { type: 'string', description: 'Scale factor (e.g., 1.5 for 150%)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('path-scale', {
        id: args.id,
        factor: Number(args.factor)
      })
      printResult(result, args.json, 'path')
    } catch (e) { handleError(e) }
  }
})
