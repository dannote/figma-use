import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Edit component property' },
  args: {
    id: { type: 'positional', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true },
    'new-name': { type: 'string', description: 'New name' },
    default: { type: 'string', description: 'New default value' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('edit-component-property', {
        componentId: args.id,
        propertyName: args.name,
        newName: args['new-name'],
        newDefaultValue: args.default
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
