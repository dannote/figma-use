import { defineCommand } from 'citty'
import { writeFileSync } from 'fs'

import { sendCommand, handleError } from '../../client.ts'
import { checkExportSize } from '../../export-guard.ts'
import { fail } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Export node as image' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    format: { type: 'string', description: 'Format: PNG, JPG, SVG, PDF', default: 'PNG' },
    scale: { type: 'string', description: 'Export scale', default: '1' },
    output: { type: 'string', description: 'Output file path' },
    timeout: { type: 'string', description: 'Timeout in seconds' },
    force: { type: 'boolean', description: 'Skip size check', alias: 'f' }
  },
  async run({ args }) {
    try {
      const scale = Number(args.scale)

      const check = await checkExportSize(args.id, scale, args.force || false)
      if (!check.ok) {
        console.error(fail(check.message!))
        process.exit(1)
      }

      const result = (await sendCommand(
        'export-node',
        {
          id: args.id,
          format: args.format.toUpperCase(),
          scale
        },
        { timeout: args.timeout ? Number(args.timeout) * 1000 : undefined }
      )) as { data: string; filename: string }

      if (args.output) {
        const buffer = Buffer.from(result.data, 'base64')
        writeFileSync(args.output, buffer)
        console.log(args.output)
      } else {
        console.log(JSON.stringify(result, null, 2))
      }
    } catch (e) {
      handleError(e)
    }
  }
})
