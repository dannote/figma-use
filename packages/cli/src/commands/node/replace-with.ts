import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { readStdin, renderFromString } from '../../render/index.ts'

export default defineCommand({
  meta: { description: 'Replace node with another node or JSX from stdin' },
  args: {
    id: { type: 'positional', description: 'Node ID to replace', required: true },
    target: {
      type: 'string',
      description: 'Target node ID (component creates instance, otherwise clones)'
    },
    stdin: { type: 'boolean', description: 'Read JSX from stdin' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let sourceId: string

      if (args.stdin) {
        const jsx = await readStdin()
        if (!jsx.trim()) throw new Error('No JSX provided on stdin')

        const original = (await sendCommand('get-node-info', { id: args.id })) as { x: number; y: number }
        const rendered = await renderFromString(jsx, { x: original.x, y: original.y })
        sourceId = rendered.id
      } else {
        if (!args.target) throw new Error('Target node ID required (or use --stdin)')
        sourceId = args.target
      }

      const result = await sendCommand('replace-node-with', {
        targetId: args.id,
        sourceId
      })

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        const r = result as { id: string; name: string; type: string }
        console.log(`✓ Replaced with ${r.type.toLowerCase()} "${r.name}" (${r.id})`)
      }
    } catch (e) {
      handleError(e)
    }
  }
})
