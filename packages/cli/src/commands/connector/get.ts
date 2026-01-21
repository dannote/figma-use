import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get connector details' },
  args: {
    id: { type: 'positional', required: true, description: 'Connector ID' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = (await sendCommand('get-connector', { id: args.id })) as {
        id: string
        name: string
        fromNode: { id: string; name: string; magnet: string }
        toNode: { id: string; name: string; magnet: string }
        lineType: string
        startCap: string
        endCap: string
        stroke: string
        strokeWeight: number
        cornerRadius: number
      }

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      console.log(`[connector] "${result.name}" (${result.id})`)
      console.log(
        `  from: ${result.fromNode.name} (${result.fromNode.id}) @ ${result.fromNode.magnet}`
      )
      console.log(`  to: ${result.toNode.name} (${result.toNode.id}) @ ${result.toNode.magnet}`)
      console.log(`  type: ${result.lineType.toLowerCase()}`)
      console.log(`  caps: ${result.startCap.toLowerCase()} → ${result.endCap.toLowerCase()}`)
      if (result.stroke) console.log(`  stroke: ${result.stroke} ${result.strokeWeight}px`)
      if (result.cornerRadius) console.log(`  radius: ${result.cornerRadius}`)
    } catch (e) {
      handleError(e)
    }
  }
})
