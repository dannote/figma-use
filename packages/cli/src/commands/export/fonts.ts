import { defineCommand } from 'citty'
import { writeFileSync } from 'fs'

import { sendCommand, handleError } from '../../client.ts'
import { googleFontsUrl } from '../../css-builder.ts'
import { getFonts, fetchGoogleFontsList, generateFontsCss, styleToWeight } from '../../fonts.ts'

export default defineCommand({
  meta: { description: 'List fonts used in the current page' },
  args: {
    page: { type: 'string', description: 'Page name (default: current page)' },
    css: { type: 'boolean', description: 'Output as CSS @font-face template' },
    google: { type: 'boolean', description: 'Output as Google Fonts URL (if available)' },
    out: { type: 'string', alias: 'o', description: 'Write CSS to file' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      if (args.page) {
        await sendCommand('set-current-page', { name: args.page })
      }

      const fonts = await getFonts()

      if (fonts.length === 0) {
        console.log(args.json ? '[]' : 'No fonts found')
        return
      }

      if (args.json) {
        console.log(JSON.stringify(fonts, null, 2))
        return
      }

      const googleFontsList = await fetchGoogleFontsList()
      const isGoogle = (family: string) => googleFontsList.has(family)

      if (args.css || args.out) {
        const css = await generateFontsCss(fonts)

        if (args.out) {
          writeFileSync(args.out, css)
          console.log(`Written to ${args.out}`)
        } else {
          console.log(css)
        }
        return
      }

      if (args.google) {
        const googleFonts = fonts.filter((f) => isGoogle(f.family))
        if (googleFonts.length === 0) {
          console.log('No Google Fonts found. These fonts need to be loaded manually:')
          for (const font of fonts) {
            console.log(`  - ${font.family} (${font.styles.join(', ')})`)
          }
          return
        }

        console.log(
          googleFontsUrl(
            googleFonts.map((f) => ({
              family: f.family,
              weights: f.styles.map(styleToWeight)
            }))
          )
        )

        const nonGoogle = fonts.filter((f) => !isGoogle(f.family))
        if (nonGoogle.length > 0) {
          console.log('\nThese fonts need to be loaded manually:')
          for (const font of nonGoogle) {
            console.log(`  - ${font.family} (${font.styles.join(', ')})`)
          }
        }
        return
      }

      // Default: list fonts
      console.log('Fonts used:')
      for (const font of fonts) {
        const googleFont = isGoogle(font.family)
        console.log(`  ${font.family}${googleFont ? ' (Google Fonts)' : ''}`)
        for (const style of font.styles) {
          console.log(`    - ${style} (${styleToWeight(style)})`)
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
