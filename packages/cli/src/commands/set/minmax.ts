import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set min/max width and height constraints' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    'min-width': { type: 'string', description: 'Minimum width' },
    'max-width': { type: 'string', description: 'Maximum width' },
    'min-height': { type: 'string', description: 'Minimum height' },
    'max-height': { type: 'string', description: 'Maximum height' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-min-max', {
        id: args.id,
        minWidth: args["min-width"] ? Number(args["min-width"]) : undefined,
        maxWidth: args["max-width"] ? Number(args["max-width"]) : undefined,
        minHeight: args["min-height"] ? Number(args["min-height"]) : undefined,
        maxHeight: args["max-height"] ? Number(args["max-height"]) : undefined
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
