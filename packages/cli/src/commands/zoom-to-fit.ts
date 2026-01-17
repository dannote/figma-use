import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Zoom viewport to fit nodes' },
  args: {
    ids: { type: 'string', description: 'Comma-separated node IDs (or empty for selection)' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('zoom-to-fit', {
        ids: args.ids ? args.ids.split(',').map(s => s.trim()) : undefined
      }))
    } catch (e) { handleError(e) }
  }
})
