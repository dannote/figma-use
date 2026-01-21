import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set stroke color and weight' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    color: { type: 'positional', description: 'Color (hex or var:Name)', required: true },
    weight: { type: 'string', description: 'Stroke weight' },
    align: { type: 'string', description: 'Stroke align: INSIDE, CENTER, OUTSIDE' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('set-stroke-color', {
        id: args.id,
        color: args.color,
        weight: args.weight ? Number(args.weight) : undefined,
        align: args.align
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
