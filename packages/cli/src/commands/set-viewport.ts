import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set viewport position and zoom' },
  args: {
    x: { type: 'string', description: 'X position' },
    y: { type: 'string', description: 'Y position' },
    zoom: { type: 'string', description: 'Zoom level (1 = 100%)' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('set-viewport', {
        x: args.x ? Number(args.x) : undefined,
        y: args.y ? Number(args.y) : undefined,
        zoom: args.zoom ? Number(args.zoom) : undefined
      }))
    } catch (e) { handleError(e) }
  }
})
