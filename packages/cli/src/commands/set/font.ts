import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set font properties' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    family: { type: 'string', description: 'Font family' },
    style: { type: 'string', description: 'Font style (Regular, Bold, etc)' },
    size: { type: 'string', description: 'Font size' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-font', {
        id: args.id,
        fontFamily: args.family,
        fontStyle: args.style,
        fontSize: args.size ? Number(args.size) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
