import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get components' },
  args: {
    name: { type: 'string', description: 'Filter by name (case-insensitive)' },
    page: { type: 'string', description: 'Filter by page ID or name' },
    limit: { type: 'string', description: 'Max results', default: '100' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('get-all-components', {
        name: args.name,
        page: args.page,
        limit: Number(args.limit)
      })
      printResult(result, args.json)
    } catch (e) { handleError(e) }
  }
})
