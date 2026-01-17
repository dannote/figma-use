import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set instance properties' },
  args: {
    id: { type: 'string', description: 'Instance ID', required: true },
    properties: { type: 'string', description: 'Properties JSON', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-instance-properties', {
          instanceId: args.id,
          properties: JSON.parse(args.properties)
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
