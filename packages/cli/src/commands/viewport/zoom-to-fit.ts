import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Zoom viewport to fit nodes' },
  args: {
    ids: { type: 'positional', description: 'Node IDs (space separated, or selection if omitted)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const ids = args.ids ? (args.ids as string).split(/[\s,]+/) : undefined
      const result = await sendCommand('zoom-to-fit', { ids })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
