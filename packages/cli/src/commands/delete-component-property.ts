import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Delete a component property' },
  args: {
    componentId: { type: 'string', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('delete-component-property', {
          componentId: args.componentId,
          name: args.name
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
