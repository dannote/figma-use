import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Delete component property' },
  args: {
    id: { type: 'positional', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('delete-component-property', {
        componentId: args.id,
        propertyName: args.name
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
