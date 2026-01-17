import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set corner radius of a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    radius: { type: 'string', description: 'Corner radius', required: true },
    topLeft: { type: 'string', description: 'Top left radius' },
    topRight: { type: 'string', description: 'Top right radius' },
    bottomLeft: { type: 'string', description: 'Bottom left radius' },
    bottomRight: { type: 'string', description: 'Bottom right radius' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-corner-radius', {
          id: args.id,
          cornerRadius: Number(args.radius),
          topLeftRadius: args.topLeft ? Number(args.topLeft) : undefined,
          topRightRadius: args.topRight ? Number(args.topRight) : undefined,
          bottomLeftRadius: args.bottomLeft ? Number(args.bottomLeft) : undefined,
          bottomRightRadius: args.bottomRight ? Number(args.bottomRight) : undefined
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
