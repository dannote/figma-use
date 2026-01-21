import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get node bounding box' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('node-bounds', { id: args.id })
      if (args.json) {
        printResult(result, true)
      } else {
        const b = result as {
          x: number
          y: number
          width: number
          height: number
          centerX: number
          centerY: number
          right: number
          bottom: number
        }
        console.log(`x: ${b.x}, y: ${b.y}`)
        console.log(`width: ${b.width}, height: ${b.height}`)
        console.log(`center: (${b.centerX}, ${b.centerY})`)
        console.log(`right: ${b.right}, bottom: ${b.bottom}`)
      }
    } catch (e) {
      handleError(e)
    }
  }
})
