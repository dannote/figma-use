import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set stroke alignment' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    align: { type: 'positional', description: 'INSIDE | OUTSIDE | CENTER', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const align = args.align.toUpperCase() as 'INSIDE' | 'OUTSIDE' | 'CENTER'
      if (!['INSIDE', 'OUTSIDE', 'CENTER'].includes(align)) {
        throw new Error('Align must be INSIDE, OUTSIDE, or CENTER')
      }
      const result = await sendCommand('set-stroke-align', { id: args.id, align })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
