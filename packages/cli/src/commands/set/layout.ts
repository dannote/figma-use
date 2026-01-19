import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set auto-layout properties' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    mode: { type: 'string', description: 'Layout mode: HORIZONTAL, VERTICAL, NONE' },
    gap: { type: 'string', description: 'Item spacing (gap)' },
    padding: { type: 'string', description: 'Padding (single or "top,right,bottom,left")' },
    align: {
      type: 'string',
      description: 'Primary axis alignment: MIN, CENTER, MAX, SPACE_BETWEEN'
    },
    'counter-align': {
      type: 'string',
      description: 'Counter axis alignment: MIN, CENTER, MAX, BASELINE'
    },
    wrap: { type: 'boolean', description: 'Enable wrap' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let paddingObj
      if (args.padding) {
        const parts = args.padding.split(',').map(Number)
        if (parts.length === 1) {
          paddingObj = { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] }
        } else if (parts.length === 4) {
          paddingObj = { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] }
        }
      }

      const result = await sendCommand('set-auto-layout', {
        id: args.id,
        mode: args.mode,
        itemSpacing: args.gap ? Number(args.gap) : undefined,
        padding: paddingObj,
        primaryAlign: args.align,
        counterAlign: args["counter-align"],
        wrap: args.wrap
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
