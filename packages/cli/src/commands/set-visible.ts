import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set node visibility' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    visible: { type: 'boolean', description: 'Visible', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('set-visible', {
        id: args.id,
        visible: args.visible
      }))
    } catch (e) { handleError(e) }
  }
})
