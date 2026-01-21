import { defineCommand } from 'citty'
import { writeFileSync } from 'fs'

import { sendCommand, handleError } from '../../client.ts'
import { checkViewportSize } from '../../export-guard.ts'
import { fail } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Screenshot current viewport' },
  args: {
    output: {
      type: 'string',
      description: 'Output file path',
      default: '/tmp/figma-screenshot.png'
    },
    scale: { type: 'string', description: 'Export scale', default: '1' },
    timeout: { type: 'string', description: 'Timeout in seconds' },
    force: { type: 'boolean', description: 'Skip size check', alias: 'f' }
  },
  async run({ args }) {
    try {
      const scale = Number(args.scale)

      const check = await checkViewportSize(scale, args.force || false)
      if (!check.ok) {
        console.error(fail(check.message!))
        process.exit(1)
      }

      const result = (await sendCommand(
        'screenshot',
        {
          scale
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
