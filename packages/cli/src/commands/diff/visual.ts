import { defineCommand } from 'citty'
import { writeFileSync } from 'fs'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { sendCommand, handleError } from '../../client.ts'
import { fail } from '../../format.ts'

interface ExportResult {
  data: string
  filename: string
}

export default defineCommand({
  meta: { description: 'Create visual diff between two nodes as PNG' },
  args: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true },
    output: { type: 'string', description: 'Output file path', required: true },
    scale: { type: 'string', description: 'Export scale (default: 1)' },
    threshold: { type: 'string', description: 'Color threshold 0-1 (default: 0.1)' }
  },
  async run({ args }) {
    try {
      const scale = args.scale ? Number(args.scale) : 1
      const threshold = args.threshold ? Number(args.threshold) : 0.1

      const [fromResult, toResult] = await Promise.all([
        sendCommand('export-node', {
          id: args.from,
          format: 'PNG',
          scale
        }) as Promise<ExportResult>,
        sendCommand('export-node', { id: args.to, format: 'PNG', scale }) as Promise<ExportResult>
      ])

      if (!fromResult?.data || !toResult?.data) {
        console.error(fail('Could not export nodes'))
        process.exit(1)
      }

      const fromPng = PNG.sync.read(Buffer.from(fromResult.data, 'base64'))
      const toPng = PNG.sync.read(Buffer.from(toResult.data, 'base64'))

      if (fromPng.width !== toPng.width || fromPng.height !== toPng.height) {
        console.error(
          fail(
            `Size mismatch: ${fromPng.width}×${fromPng.height} vs ${toPng.width}×${toPng.height}`
          )
        )
        process.exit(1)
      }

      const { width, height } = fromPng
      const diff = new PNG({ width, height })

      const diffPixels = pixelmatch(fromPng.data, toPng.data, diff.data, width, height, {
        threshold
      })

      const totalPixels = width * height
      const diffPercent = ((diffPixels / totalPixels) * 100).toFixed(2)

      writeFileSync(args.output, PNG.sync.write(diff))

      console.log(`${diffPixels} pixels differ (${diffPercent}%)`)
      console.log(`Saved to ${args.output}`)
    } catch (e) {
      handleError(e)
    }
  }
})
