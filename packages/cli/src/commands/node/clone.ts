import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Clone node(s)' },
  args: {
    ids: { type: 'positional', description: 'Node ID(s) separated by space', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const ids = args.ids.split(/\s+/).filter(Boolean)
      const result = await sendCommand('clone-node', { ids })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
