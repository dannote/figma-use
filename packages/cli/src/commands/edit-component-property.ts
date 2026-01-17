import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Edit a component property' },
  args: {
    componentId: { type: 'string', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true },
    type: { type: 'string', description: 'Property type (BOOLEAN, TEXT, INSTANCE_SWAP, VARIANT)', required: true },
    defaultValue: { type: 'string', description: 'Default value', required: true },
    preferredValues: { type: 'string', description: 'Preferred values JSON array' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('edit-component-property', {
          componentId: args.componentId,
          name: args.name,
          type: args.type,
          defaultValue: args.defaultValue,
          preferredValues: args.preferredValues ? JSON.parse(args.preferredValues) : undefined
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
