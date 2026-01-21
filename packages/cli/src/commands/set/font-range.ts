import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Set font properties for a text range' },
  args: {
    id: { type: 'positional', description: 'Text node ID', required: true },
    start: { type: 'string', required: true, description: 'Start index (0-based)' },
    end: { type: 'string', required: true, description: 'End index (exclusive)' },
    family: { type: 'string', description: 'Font family' },
    style: { type: 'string', description: 'Font style (Regular, Bold, Italic, etc)' },
    size: { type: 'string', description: 'Font size' },
    color: { type: 'string', description: 'Text color (hex or var:Name)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-font-range', {
        id: args.id,
        start: parseInt(args.start),
        end: parseInt(args.end),
        family: args.family,
        style: args.style,
        size: args.size ? parseFloat(args.size) : undefined,
        color: args.color
      })
      printResult(result, args.json)
    } catch (error) {
      handleError(error)
    }
  }
})
