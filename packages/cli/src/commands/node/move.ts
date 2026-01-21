import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Move a node' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    x: { type: 'string', description: 'X position', required: true },
    y: { type: 'string', description: 'Y position', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('move-node', {
        id: args.id,
        x: Number(args.x),
        y: Number(args.y)
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
