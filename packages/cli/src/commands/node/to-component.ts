import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { ok } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Convert frame(s) to component(s)' },
  args: {
    ids: { type: 'positional', description: 'Node IDs to convert', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const ids = args.ids.split(/[\s,]+/).filter(Boolean)

      const result = await sendCommand<Array<{ id: string; name: string }>>('eval', {
        code: `
          const ids = ${JSON.stringify(ids)}
          const result = []
          for (const id of ids) {
            const node = await figma.getNodeByIdAsync(id)
            if (node && 'createComponentFromNode' in figma) {
              const comp = figma.createComponentFromNode(node)
              result.push({ id: comp.id, name: comp.name })
            }
          }
          return result
        `
      })

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
