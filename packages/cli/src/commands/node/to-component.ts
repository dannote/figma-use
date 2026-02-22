import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { ok } from '../../format.ts'

import type { NodeRef } from '../../types.ts'

export default defineCommand({
  meta: { description: 'Convert frame(s) to component(s)' },
  args: {
    ids: { type: 'positional', description: 'Node IDs to convert', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand<NodeRef[]>('to-component', { ids: args.ids })

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        for (const comp of result) {
          console.log(ok(`Converted to component "${comp.name}" (${comp.id})`))
        }
      }
    } catch (error) {
      handleError(error)
    }
  }
})
