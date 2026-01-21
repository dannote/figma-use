import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Rename a node' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    name: { type: 'positional', description: 'New name', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('rename-node', { id: args.id, name: args.name })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
