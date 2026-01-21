import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Switch to page by ID or name' },
  args: {
    page: { type: 'positional', description: 'Page ID or name', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-current-page', { page: args.page })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
