import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Set vector path data' },
  args: {
    id: { type: 'positional', description: 'Vector node ID', required: true },
    path: { type: 'positional', description: 'SVG path data', required: true },
    windingRule: {
      type: 'string',
      description: 'Winding rule (NONZERO or EVENODD)',
      default: 'NONZERO'
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('path-set', {
        id: args.id,
        path: args.path,
        windingRule: args.windingRule
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
