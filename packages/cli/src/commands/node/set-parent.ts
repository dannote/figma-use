import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Move node to a different parent' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    parent: { type: 'string', description: 'Parent node ID', required: true },
    index: { type: 'string', description: 'Index in parent children' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-parent-id', {
        id: args.id,
        parentId: args.parent,
        index: args.index ? Number(args.index) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
