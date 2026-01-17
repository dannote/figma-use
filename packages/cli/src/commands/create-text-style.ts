import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a text style' },
  args: {
    name: { type: 'string', description: 'Style name', required: true },
    fontFamily: { type: 'string', description: 'Font family', default: 'Inter' },
    fontStyle: { type: 'string', description: 'Font style (Regular, Bold, etc)', default: 'Regular' },
    fontSize: { type: 'string', description: 'Font size', default: '16' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-text-style', {
        name: args.name,
        fontFamily: args.fontFamily,
        fontStyle: args.fontStyle,
        fontSize: Number(args.fontSize)
      }))
    } catch (e) { handleError(e) }
  }
})
