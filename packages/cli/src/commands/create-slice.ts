import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a slice for export' },
  args: {
    x: { type: 'string', description: 'X position', required: true },
    y: { type: 'string', description: 'Y position', required: true },
    width: { type: 'string', description: 'Width', required: true },
    height: { type: 'string', description: 'Height', required: true },
    name: { type: 'string', description: 'Slice name' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-slice', {
        x: Number(args.x),
        y: Number(args.y),
        width: Number(args.width),
        height: Number(args.height),
        name: args.name
      }))
    } catch (e) { handleError(e) }
  }
})
