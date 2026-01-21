import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Move all path points by offset' },
  args: {
    id: { type: 'positional', description: 'Vector node ID', required: true },
    dx: { type: 'string', description: 'X offset', default: '0' },
    dy: { type: 'string', description: 'Y offset', default: '0' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('path-move', {
        id: args.id,
        dx: Number(args.dx),
        dy: Number(args.dy)
      })
      printResult(result, args.json, 'path')
    } catch (e) {
      handleError(e)
    }
  }
})
