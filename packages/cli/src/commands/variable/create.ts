import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a variable' },
  args: {
    name: { type: 'positional', description: 'Variable name', required: true },
    collection: { type: 'string', description: 'Collection ID', required: true },
    type: { type: 'string', description: 'Type: COLOR, FLOAT, STRING, BOOLEAN', required: true },
    value: { type: 'string', description: 'Initial value' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-variable', {
        name: args.name,
        collectionId: args.collection,
        type: args.type,
        value: args.value
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
