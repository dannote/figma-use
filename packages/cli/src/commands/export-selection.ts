import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../client.ts'
import { writeFileSync } from 'fs'

export default defineCommand({
  meta: { description: 'Export current selection as image' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' },
    output: { type: 'string', description: 'Output file path', default: '/tmp/figma-selection.png' },
    format: { type: 'string', description: 'Format: PNG, JPG, SVG, PDF', default: 'PNG' },
    scale: { type: 'string', description: 'Export scale', default: '2' },
    padding: { type: 'string', description: 'Padding around selection', default: '0' },
    timeout: { type: 'string', description: 'Timeout in seconds' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('export-selection', {
        format: args.format.toUpperCase(),
        scale: Number(args.scale),
        padding: Number(args.padding)
      }, { timeout: args.timeout ? Number(args.timeout) * 1000 : undefined }) as { data: string }
      
      const buffer = Buffer.from(result.data, 'base64')
      writeFileSync(args.output, buffer)
      console.log(args.output)
    } catch (e) { handleError(e) }
  }
})
