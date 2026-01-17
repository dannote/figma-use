import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set node locked state' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    locked: { type: 'boolean', description: 'Locked', required: true }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('set-locked', {
        id: args.id,
        locked: args.locked
      }))
    } catch (e) { handleError(e) }
  }
})
