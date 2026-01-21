import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { dim } from '../../format.ts'

interface Font {
  family: string
  style: string
}

export default defineCommand({
  meta: { description: 'List available fonts' },
  args: {
    family: { type: 'string', description: 'Filter by family name' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const fonts = await sendCommand<Font[]>('list-fonts')

      let filtered = fonts
      if (args.family) {
        const search = args.family.toLowerCase()
        filtered = fonts.filter((f) => f.family.toLowerCase().includes(search))
      }

      if (args.json) {
        console.log(JSON.stringify(filtered, null, 2))
        return
      }

      // Group by family
      const families = new Map<string, string[]>()
      for (const font of filtered) {
        const styles = families.get(font.family) || []
        styles.push(font.style)
        families.set(font.family, styles)
      }

      for (const [family, styles] of families) {
        console.log(`${family} ${dim(`(${styles.join(', ')})`)}`)
      }

      console.log(`\n${families.size} families, ${filtered.length} fonts`)
    } catch (e) {
      handleError(e)
    }
  }
})
