import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set image fill from URL' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    url: { type: 'string', description: 'Image URL', required: true },
    scaleMode: { type: 'string', description: 'Scale mode: FILL, FIT, CROP, TILE', default: 'FILL' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('set-image-fill', {
        id: args.id,
        url: args.url,
        scaleMode: args.scaleMode
      }))
    } catch (e) { handleError(e) }
  }
})
