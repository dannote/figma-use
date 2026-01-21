import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'List connectors on current page' },
  args: {
    from: { type: 'string', description: 'Filter by start node ID' },
    to: { type: 'string', description: 'Filter by end node ID' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = (await sendCommand('list-connectors', {
        fromId: args.from,
        toId: args.to
      })) as Array<{
        id: string
        name: string
        fromNode: { id: string; name: string; magnet: string }
        toNode: { id: string; name: string; magnet: string }
        lineType: string
        stroke: string
      }>

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      if (result.length === 0) {
        console.log('(no connectors)')
        return
      }

      result.forEach((c, i) => {
        const from = `${c.fromNode.name} (${c.fromNode.id})`
        const to = `${c.toNode.name} (${c.toNode.id})`
        console.log(`[${i}] "${c.name}" (${c.id})`)
        console.log(`    ${from} → ${to}`)
        if (c.stroke) console.log(`    stroke: ${c.stroke}`)
      })

      console.log(`\n${result.length} connector(s)`)
    } catch (e) {
      handleError(e)
    }
  }
})
