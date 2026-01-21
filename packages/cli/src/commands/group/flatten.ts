import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Flatten nodes into single vector' },
  args: {
    ids: { type: 'positional', description: 'Node IDs (space or comma separated)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const ids = (args.ids as string).split(/[\s,]+/)
      const result = await sendCommand('flatten-nodes', { ids })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
