import { defineCommand } from 'citty'
import { writeFileSync } from 'fs'

import { sendCommand, handleError } from '../../client.ts'
import { checkSelectionSize } from '../../export-guard.ts'
import { fail } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Export selection as image' },
  args: {
    format: { type: 'string', description: 'Format: PNG, JPG, SVG, PDF', default: 'PNG' },
    scale: { type: 'string', description: 'Export scale', default: '2' },
    output: {
      type: 'string',
      description: 'Output file path',
      default: '/tmp/figma-selection.png'
    },
    padding: { type: 'string', description: 'Padding around selection', default: '0' },
    timeout: { type: 'string', description: 'Timeout in seconds' },
    force: { type: 'boolean', description: 'Skip size check', alias: 'f' }
  },
  async run({ args }) {
    try {
      const scale = Number(args.scale)
      const padding = Number(args.padding)

      const check = await checkSelectionSize(scale, padding, args.force || false)
      if (!check.ok) {
        console.error(fail(check.message!))
        process.exit(1)
      }

      const result = (await sendCommand(
        'export-selection',
        {
          format: args.format.toUpperCase(),
          scale,
          padding
        },
        { timeout: args.timeout ? Number(args.timeout) * 1000 : undefined }
      )) as { data: string }

      const buffer = Buffer.from(result.data, 'base64')
      writeFileSync(args.output, buffer)
      console.log(args.output)
    } catch (e) {
      handleError(e)
    }
  }
})
