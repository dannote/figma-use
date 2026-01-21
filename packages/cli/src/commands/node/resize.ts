import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Resize a node' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    width: { type: 'string', description: 'Width', required: true },
    height: { type: 'string', description: 'Height', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('resize-node', {
        id: args.id,
        width: Number(args.width),
        height: Number(args.height)
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
