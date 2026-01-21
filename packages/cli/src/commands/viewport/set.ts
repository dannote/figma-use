import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set viewport position and zoom' },
  args: {
    x: { type: 'string', description: 'X position' },
    y: { type: 'string', description: 'Y position' },
    zoom: { type: 'string', description: 'Zoom level' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-viewport', {
        x: args.x ? Number(args.x) : undefined,
        y: args.y ? Number(args.y) : undefined,
        zoom: args.zoom ? Number(args.zoom) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
