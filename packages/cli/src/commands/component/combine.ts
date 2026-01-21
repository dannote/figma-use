import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Combine components into a component set (variants)' },
  args: {
    ids: { type: 'positional', description: 'Component IDs to combine', required: true },
    name: { type: 'string', description: 'Name for the component set' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const ids = args.ids.split(',').map((id) => id.trim())
      const result = await sendCommand('combine-as-variants', { ids, name: args.name })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
