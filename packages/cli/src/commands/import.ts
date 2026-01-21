import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Import SVG' },
  args: {
    svg: { type: 'string', description: 'SVG content', required: true },
    x: { type: 'string', description: 'X coordinate', default: '0' },
    y: { type: 'string', description: 'Y coordinate', default: '0' },
    parent: { type: 'string', description: 'Parent node ID' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('import-svg', {
        svg: args.svg,
        x: Number(args.x),
        y: Number(args.y),
        parentId: args.parent
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
