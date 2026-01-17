import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Add a component property' },
  args: {
    componentId: { type: 'string', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true },
    type: { type: 'string', description: 'Property type (BOOLEAN, TEXT, INSTANCE_SWAP, VARIANT)', required: true },
    defaultValue: { type: 'string', description: 'Default value', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('add-component-property', {
          componentId: args.componentId,
          name: args.name,
          type: args.type,
          defaultValue: args.defaultValue
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
