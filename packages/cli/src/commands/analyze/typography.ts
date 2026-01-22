import { defineCommand } from 'citty'
import { sendCommand } from '../../client.ts'

interface TypographyStyle {
  family: string
  size: number
  weight: string
  lineHeight: string
  count: number
  nodes: string[]
  isStyle: boolean
}

export default defineCommand({
  meta: { description: 'Analyze typography usage' },
  args: {
    limit: { type: 'string', description: 'Max styles to show', default: '30' },
    'group-by': { type: 'string', description: 'Group by: family, size, weight', default: '' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const limit = Number(args.limit)
    const groupBy = args['group-by']

    const result = (await sendCommand('analyze-typography', {})) as {
      styles: TypographyStyle[]
      totalTextNodes: number
    }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    if (result.styles.length === 0) {
      console.log('No text nodes found')
      return
    }

    const sorted = result.styles.sort((a, b) => b.count - a.count)

    if (groupBy === 'family') {
      const byFamily = new Map<string, number>()
      for (const s of sorted) {
        byFamily.set(s.family, (byFamily.get(s.family) || 0) + s.count)
      }
      console.log('Font families:\n')
      const families = [...byFamily.entries()].sort((a, b) => b[1] - a[1])
      for (const [family, count] of families) {
        const bar = '█'.repeat(Math.min(Math.ceil(count / 20), 30))
        console.log(`${family.padEnd(20)} ${bar} ${count}×`)
      }
    } else if (groupBy === 'size') {
      const bySize = new Map<number, number>()
      for (const s of sorted) {
        bySize.set(s.size, (bySize.get(s.size) || 0) + s.count)
      }
      console.log('Font sizes:\n')
      const sizes = [...bySize.entries()].sort((a, b) => a[0] - b[0])
      for (const [size, count] of sizes) {
        const bar = '█'.repeat(Math.min(Math.ceil(count / 20), 30))
        console.log(`${String(size).padStart(3)}px ${bar} ${count}×`)
      }
    } else if (groupBy === 'weight') {
      const byWeight = new Map<string, number>()
      for (const s of sorted) {
        byWeight.set(s.weight, (byWeight.get(s.weight) || 0) + s.count)
      }
      console.log('Font weights:\n')
      const weights = [...byWeight.entries()].sort((a, b) => b[1] - a[1])
      for (const [weight, count] of weights) {
        const bar = '█'.repeat(Math.min(Math.ceil(count / 20), 30))
        console.log(`${weight.padEnd(12)} ${bar} ${count}×`)
      }
    } else {
      console.log('Typography styles:\n')
      for (const s of sorted.slice(0, limit)) {
        const bar = '█'.repeat(Math.min(Math.ceil(s.count / 10), 20))
        const styleTag = s.isStyle ? ' (style)' : ''
        console.log(`${s.family} ${s.size}px ${s.weight}${styleTag}`)
        console.log(`    ${bar} ${s.count}×`)
      }
    }

    const withStyle = result.styles.filter((s) => s.isStyle)
    const withoutStyle = result.styles.filter((s) => !s.isStyle)

    console.log()
    console.log(`${result.styles.length} unique styles from ${result.totalTextNodes} text nodes`)
    console.log(`  ${withStyle.length} use text styles, ${withoutStyle.length} hardcoded`)
  },
})
