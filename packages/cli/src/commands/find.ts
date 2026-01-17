import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Find nodes by name or type' },
  args: {
    name: { type: 'string', description: 'Node name to search (partial match)' },
    type: { type: 'string', description: 'Node type: FRAME, TEXT, RECTANGLE, INSTANCE, etc' },
    limit: { type: 'string', description: 'Max results (default: 100)', default: '100' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('find-by-name', { 
        name: args.name,
        type: args.type,
        limit: Number(args.limit)
      })
      printResult(result, args.json)
    } catch (e) { handleError(e) }
  }
})
