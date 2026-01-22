import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'

interface Binding {
  index: number
  variableId: string
  variableName: string
}

interface BindingsResult {
  id: string
  name: string
  type: string
  fills?: Binding[]
  strokes?: Binding[]
}

export default defineCommand({
  meta: { description: 'Get variable bindings for fills and strokes' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = (await sendCommand('get-node-bindings', { id: args.id })) as BindingsResult

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      const type = (result.type || 'node').toLowerCase()
      console.log(`[${type}] "${result.name}" (${result.id})`)

      if (result.fills?.length) {
        console.log('  fills:')
        for (const b of result.fills) {
          console.log(`    [${b.index}] $${b.variableName}`)
        }
      }

      if (result.strokes?.length) {
        console.log('  strokes:')
        for (const b of result.strokes) {
          console.log(`    [${b.index}] $${b.variableName}`)
        }
      }

      if (!result.fills?.length && !result.strokes?.length) {
        console.log('  (no bindings)')
      }
    } catch (e) {
      handleError(e)
    }
  }
})
