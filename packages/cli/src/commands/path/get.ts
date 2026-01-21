import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get vector path data' },
  args: {
    id: { type: 'positional', description: 'Vector node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = (await sendCommand('path-get', { id: args.id })) as {
        paths: Array<{ windingRule: string; data: string }>
      }
      if (args.json) {
        printResult(result, true)
      } else {
        for (const p of result.paths) {
          console.log(p.data)
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
