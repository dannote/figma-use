import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set fill color' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    color: { type: 'positional', description: 'Color (hex or var:Name)', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-fill-color', { id: args.id, color: args.color })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
