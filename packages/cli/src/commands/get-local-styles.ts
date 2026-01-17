import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get local styles (paint, text, effect, grid)' },
  args: {
    type: { type: 'string', description: 'Style type: paint, text, effect, grid, or all', default: 'all' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('get-local-styles', { type: args.type }))
    } catch (e) { handleError(e) }
  }
})
