import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set corner radius' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    radius: { type: 'string', description: 'Uniform radius' },
    'top-left': { type: 'string', description: 'Top left radius' },
    'top-right': { type: 'string', description: 'Top right radius' },
    'bottom-left': { type: 'string', description: 'Bottom left radius' },
    'bottom-right': { type: 'string', description: 'Bottom right radius' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-corner-radius', {
        id: args.id,
        cornerRadius: args.radius ? Number(args.radius) : 0,
        topLeftRadius: args['top-left'] ? Number(args['top-left']) : undefined,
        topRightRadius: args['top-right'] ? Number(args['top-right']) : undefined,
        bottomLeftRadius: args['bottom-left'] ? Number(args['bottom-left']) : undefined,
        bottomRightRadius: args['bottom-right'] ? Number(args['bottom-right']) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
