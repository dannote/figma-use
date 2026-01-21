import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Add property to component' },
  args: {
    id: { type: 'positional', description: 'Component ID', required: true },
    name: { type: 'string', description: 'Property name', required: true },
    type: {
      type: 'string',
      description: 'BOOLEAN | TEXT | INSTANCE_SWAP | VARIANT',
      required: true
    },
    default: { type: 'string', description: 'Default value', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const type = args.type.toUpperCase() as 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT'
      if (!['BOOLEAN', 'TEXT', 'INSTANCE_SWAP', 'VARIANT'].includes(type)) {
        throw new Error('Type must be BOOLEAN, TEXT, INSTANCE_SWAP, or VARIANT')
      }
      const result = await sendCommand('add-component-property', {
        componentId: args.id,
        name: args.name,
        type,
        defaultValue: args.default
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
