import { defineCommand } from 'citty'
import { readFileSync } from 'fs'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set image fill from file' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    file: { type: 'positional', description: 'Image file path', required: true },
    mode: { type: 'string', description: 'Scale mode: FILL, FIT, CROP, TILE', default: 'FILL' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const buffer = readFileSync(args.file)
      const base64 = buffer.toString('base64')
      const result = await sendCommand('set-image-fill', {
        id: args.id,
        imageData: base64,
        scaleMode: args.mode
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
