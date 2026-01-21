import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a text style' },
  args: {
    name: { type: 'positional', description: 'Style name', required: true },
    family: { type: 'string', description: 'Font family', default: 'Inter' },
    style: { type: 'string', description: 'Font style', default: 'Regular' },
    size: { type: 'string', description: 'Font size', default: '16' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-text-style', {
        name: args.name,
        fontFamily: args.family,
        fontStyle: args.style,
        fontSize: Number(args.size)
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
