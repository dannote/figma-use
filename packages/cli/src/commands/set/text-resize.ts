import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set text auto resize mode' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    mode: {
      type: 'positional',
      description: 'Resize mode: none, height, width-and-height, truncate',
      required: true
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const modeMap: Record<string, string> = {
        none: 'NONE',
        height: 'HEIGHT',
        'width-and-height': 'WIDTH_AND_HEIGHT',
        truncate: 'TRUNCATE'
      }
      const mode = modeMap[args.mode.toLowerCase()] || args.mode.toUpperCase()
      const result = await sendCommand('set-text-auto-resize', { id: args.id, mode })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
