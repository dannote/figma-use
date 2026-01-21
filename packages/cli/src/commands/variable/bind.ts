import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Bind variable to node property' },
  args: {
    node: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description: 'Field: fills, strokes, opacity, width, height, etc',
      required: true
    },
    variable: { type: 'string', description: 'Variable ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('bind-variable', {
        nodeId: args.node,
        field: args.field,
        variableId: args.variable
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
