import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set layout of a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: { type: 'string', description: 'Layout mode (NONE, HORIZONTAL, VERTICAL)', required: true },
    wrap: { type: 'boolean', description: 'Enable wrapping' },
    clip: { type: 'boolean', description: 'Clip content' },
    itemSpacing: { type: 'string', description: 'Item spacing' },
    primaryAxisAlign: { type: 'string', description: 'Primary axis alignment (MIN, MAX, CENTER, SPACE_BETWEEN)' },
    counterAxisAlign: { type: 'string', description: 'Counter axis alignment (MIN, MAX, CENTER, SPACE_BETWEEN)' },
    paddingLeft: { type: 'string', description: 'Left padding' },
    paddingRight: { type: 'string', description: 'Right padding' },
    paddingTop: { type: 'string', description: 'Top padding' },
    paddingBottom: { type: 'string', description: 'Bottom padding' },
    sizingVertical: { type: 'string', description: 'Vertical sizing (FIXED, HUG, FILL)' },
    sizingHorizontal: { type: 'string', description: 'Horizontal sizing (FIXED, HUG, FILL)' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-layout', {
          id: args.id,
          mode: args.mode,
          wrap: args.wrap,
          clip: args.clip,
          itemSpacing: args.itemSpacing ? Number(args.itemSpacing) : undefined,
          primaryAxisAlignItems: args.primaryAxisAlign,
          counterAxisAlignItems: args.counterAxisAlign,
          paddingLeft: args.paddingLeft ? Number(args.paddingLeft) : undefined,
          paddingRight: args.paddingRight ? Number(args.paddingRight) : undefined,
          paddingTop: args.paddingTop ? Number(args.paddingTop) : undefined,
          paddingBottom: args.paddingBottom ? Number(args.paddingBottom) : undefined,
          layoutSizingVertical: args.sizingVertical,
          layoutSizingHorizontal: args.sizingHorizontal
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
