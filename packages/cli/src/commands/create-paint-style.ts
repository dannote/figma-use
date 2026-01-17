import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a paint/color style' },
  args: {
    name: { type: 'string', description: 'Style name', required: true },
    color: { type: 'string', description: 'Hex color (e.g. #FF0000)', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-paint-style', {
        name: args.name,
        color: args.color
      }))
    } catch (e) { handleError(e) }
  }
})
