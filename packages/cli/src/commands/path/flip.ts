import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Flip path horizontally or vertically' },
  args: {
    id: { type: 'positional', description: 'Vector node ID', required: true },
    axis: { type: 'string', description: 'Axis to flip (x or y)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      if (args.axis !== 'x' && args.axis !== 'y') {
        console.error('Axis must be "x" or "y"')
        process.exit(1)
      }
      const result = await sendCommand('path-flip', {
        id: args.id,
        axis: args.axis
      })
      printResult(result, args.json, 'path')
    } catch (e) { handleError(e) }
  }
})
