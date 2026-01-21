import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

type GridTrackSize = { type: 'FIXED' | 'FLEX' | 'HUG'; value?: number }

function parseGridTemplate(template: string): GridTrackSize[] {
  return template.split(/\s+/).map((part) => {
    if (part === 'auto' || part === 'hug') {
      return { type: 'HUG' as const }
    }
    if (part.endsWith('fr')) {
      return { type: 'FLEX' as const, value: Number(part.slice(0, -2)) || 1 }
    }
    if (part.endsWith('px')) {
      return { type: 'FIXED' as const, value: Number(part.slice(0, -2)) }
    }
    return { type: 'FIXED' as const, value: Number(part) }
  })
}

export default defineCommand({
  meta: { description: 'Set auto-layout properties' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    mode: { type: 'string', description: 'Layout mode: HORIZONTAL, VERTICAL, GRID, NONE' },
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
    cols: { type: 'string', description: 'Grid columns: "160px 1fr" or "auto auto"' },
    rows: { type: 'string', description: 'Grid rows: "auto auto" or "100px 1fr"' },
    'col-gap': { type: 'string', description: 'Grid column gap' },
    'row-gap': { type: 'string', description: 'Grid row gap' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let paddingObj
      if (args.padding) {
        const parts = args.padding.split(',').map(Number)
        if (parts.length === 1) {
          const p = parts[0]!
          paddingObj = { top: p, right: p, bottom: p, left: p }
        } else if (parts.length === 4) {
          paddingObj = { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! }
        }
      }

      const result = await sendCommand('set-auto-layout', {
        id: args.id,
        mode: args.mode?.toUpperCase(),
        itemSpacing: args.gap ? Number(args.gap) : undefined,
        padding: paddingObj,
        primaryAlign: args.align,
        counterAlign: args['counter-align'],
        wrap: args.wrap,
        gridColumnSizes: args.cols ? parseGridTemplate(args.cols) : undefined,
        gridRowSizes: args.rows ? parseGridTemplate(args.rows) : undefined,
        gridColumnGap: args['col-gap'] ? Number(args['col-gap']) : undefined,
        gridRowGap: args['row-gap'] ? Number(args['row-gap']) : undefined
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
