import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../client.ts'
import { writeFileSync } from 'fs'

export default defineCommand({
  meta: { description: 'Export node as image' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' },
    id: { type: 'string', description: 'Node ID', required: true },
    format: { type: 'string', description: 'Format: PNG, JPG, SVG, PDF', default: 'PNG' },
    scale: { type: 'string', description: 'Export scale', default: '1' },
    output: { type: 'string', description: 'Output file path' },
    timeout: { type: 'string', description: 'Timeout in seconds' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('export-node', {
        id: args.id,
        format: args.format.toUpperCase(),
        scale: Number(args.scale)
      }, { timeout: args.timeout ? Number(args.timeout) * 1000 : undefined }) as { data: string; filename: string }
      
      if (args.output) {
        const buffer = Buffer.from(result.data, 'base64')
        writeFileSync(args.output, buffer)
        console.log(`Exported to ${args.output}`)
      } else {
        console.log(JSON.stringify(result, null, 2))
      }
    } catch (e) { handleError(e) }
  }
})
