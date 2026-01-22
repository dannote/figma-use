import { defineCommand } from 'citty'
import { sendCommand } from '../../client.ts'

interface SpacingValue {
  value: number
  type: 'gap' | 'padding' | 'itemSpacing'
  count: number
  nodes: string[]
}

export default defineCommand({
  meta: { description: 'Analyze spacing values (gap, padding)' },
  args: {
    grid: { type: 'string', description: 'Base grid size to check against', default: '8' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const gridSize = Number(args.grid)

    const result = (await sendCommand('analyze-spacing', {})) as {
      gaps: SpacingValue[]
      paddings: SpacingValue[]
      totalNodes: number
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    const allGaps = result.gaps.sort((a, b) => b.count - a.count)
    const allPaddings = result.paddings.sort((a, b) => b.count - a.count)

    if (allGaps.length > 0) {
      console.log('Gap values:\n')
      for (const g of allGaps.slice(0, 15)) {
        const bar = '█'.repeat(Math.min(Math.ceil(g.count / 5), 30))
        const offGrid = g.value % gridSize !== 0 ? ' ⚠' : ''
        console.log(`${String(g.value).padStart(4)}px ${bar} ${g.count}×${offGrid}`)
      }
    }

    if (allPaddings.length > 0) {
      console.log('\nPadding values:\n')
      for (const p of allPaddings.slice(0, 15)) {
        const bar = '█'.repeat(Math.min(Math.ceil(p.count / 5), 30))
        const offGrid = p.value % gridSize !== 0 ? ' ⚠' : ''
        console.log(`${String(p.value).padStart(4)}px ${bar} ${p.count}×${offGrid}`)
      }
    }

    const offGridGaps = allGaps.filter((g) => g.value % gridSize !== 0 && g.value > 0)
    const offGridPaddings = allPaddings.filter((p) => p.value % gridSize !== 0 && p.value > 0)

    console.log()
    console.log(`${allGaps.length} gap values, ${allPaddings.length} padding values`)

    if (offGridGaps.length > 0 || offGridPaddings.length > 0) {
      console.log(`\n⚠ Off-grid values (not divisible by ${gridSize}px):`)
      if (offGridGaps.length > 0) {
        const vals = offGridGaps.map((g) => `${g.value}px`).join(', ')
        console.log(`  gaps: ${vals}`)
      }
      if (offGridPaddings.length > 0) {
        const vals = offGridPaddings.map((p) => `${p.value}px`).join(', ')
        console.log(`  paddings: ${vals}`)
      }
    }
  },
})
