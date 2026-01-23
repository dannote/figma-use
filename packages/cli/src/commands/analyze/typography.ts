import { histogram, summary } from 'agentfmt'
import { defineCommand } from 'citty'

import { sendCommand } from '../../client.ts'

interface TypographyStyle {
  family: string
  size: number
  weight: string
  lineHeight: string
  count: number
  nodes: string[]
  styleName: string | null
}

export default defineCommand({
  meta: { description: 'Analyze typography usage' },
  args: {
    limit: { type: 'string', description: 'Max styles to show', default: '30' },
    'group-by': { type: 'string', description: 'Group by: family, size, weight', default: '' },
    json: { type: 'boolean', description: 'Output as JSON' }
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
      console.log(
        histogram(
          families.map(([family, count]) => ({
            label: family.padEnd(20),
            value: count
          })),
          { scale: 20 }
        )
      )
    } else if (groupBy === 'size') {
      const bySize = new Map<number, number>()
      for (const s of sorted) {
        bySize.set(s.size, (bySize.get(s.size) || 0) + s.count)
      }
      console.log('Font sizes:\n')
      const sizes = [...bySize.entries()].sort((a, b) => a[0] - b[0])
      console.log(
        histogram(
          sizes.map(([size, count]) => ({
            label: `${String(size).padStart(3)}px`,
            value: count
          })),
          { scale: 20 }
        )
      )
    } else if (groupBy === 'weight') {
      const byWeight = new Map<string, number>()
      for (const s of sorted) {
        byWeight.set(s.weight, (byWeight.get(s.weight) || 0) + s.count)
      }
      console.log('Font weights:\n')
      const weights = [...byWeight.entries()].sort((a, b) => b[1] - a[1])
      console.log(
        histogram(
          weights.map(([weight, count]) => ({
            label: weight.padEnd(12),
            value: count
          })),
          { scale: 20 }
        )
      )
    } else {
      console.log('Typography styles:\n')
      const items = sorted.slice(0, limit).map((s) => {
        const lh = s.lineHeight !== 'auto' ? ` / ${s.lineHeight}` : ''
        return {
          label: `${s.family} ${s.size}px ${s.weight}${lh}`,
          value: s.count,
          tag: s.styleName || undefined
        }
      })
      console.log(histogram(items))
    }

    const withStyle = result.styles.filter((s) => s.styleName)
    const withoutStyle = result.styles.filter((s) => !s.styleName)

    console.log()
    console.log(
      summary({ 'unique styles': result.styles.length }) +
        ` from ${result.totalTextNodes} text nodes`
    )
    console.log(`  ${withStyle.length} use text styles, ${withoutStyle.length} hardcoded`)
  }
})
