import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a paint/color style' },
  args: {
    name: { type: 'positional', description: 'Style name', required: true },
    color: { type: 'string', description: 'Color (hex or var:Name)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-paint-style', { name: args.name, color: args.color })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
