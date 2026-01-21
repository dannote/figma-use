import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set rotation angle' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    angle: { type: 'string', description: 'Angle in degrees', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-rotation', { id: args.id, angle: Number(args.angle) })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
