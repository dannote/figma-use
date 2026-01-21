import { defineCommand } from 'citty'
import { sendCommand, handleError } from '../../client.ts'

interface FontInfo {
  family: string
  styles: string[]
  weights: number[]
}

export default defineCommand({
  meta: { description: 'List fonts used in the current page or selection' },
  args: {
    page: { type: 'string', description: 'Page name (default: current page)' },
    css: { type: 'boolean', description: 'Output as CSS @font-face template' },
    google: { type: 'boolean', description: 'Output as Google Fonts URL (if available)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      if (args.page) {
        await sendCommand('set-current-page', { name: args.page })
      }

      const fonts = await sendCommand<FontInfo[]>('get-fonts')

      if (!fonts || fonts.length === 0) {
        console.log(args.json ? '[]' : 'No fonts found')
        return
      }

      if (args.json) {
        console.log(JSON.stringify(fonts, null, 2))
        return
      }

      if (args.css) {
        console.log('/* Add your font files and update the src paths */')
        for (const font of fonts) {
          for (const style of font.styles) {
            const weight = styleToWeight(style)
            const fontStyle = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
            console.log(`
@font-face {
  font-family: '${font.family}';
  font-weight: ${weight};
  font-style: ${fontStyle};
  src: url('./fonts/${font.family.replace(/\s+/g, '-')}-${style}.woff2') format('woff2');
}`)
          }
        }
        return
      }

      if (args.google) {
        const googleFonts = fonts.filter(f => isGoogleFont(f.family))
        if (googleFonts.length === 0) {
          console.log('No Google Fonts found. These fonts need to be loaded manually:')
          for (const font of fonts) {
            console.log(`  - ${font.family} (${font.styles.join(', ')})`)
          }
          return
        }
        
        const params = googleFonts.map(f => {
          const weights = f.styles.map(styleToWeight).sort((a, b) => a - b)
          return `family=${encodeURIComponent(f.family)}:wght@${weights.join(';')}`
        }).join('&')
        
        console.log(`https://fonts.googleapis.com/css2?${params}&display=swap`)
        
        const nonGoogle = fonts.filter(f => !isGoogleFont(f.family))
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
        console.log(`  ${font.family}`)
        for (const style of font.styles) {
          console.log(`    - ${style} (${styleToWeight(style)})`)
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})

function styleToWeight(style: string): number {
  const styleMap: Record<string, number> = {
    'Thin': 100, 'Hairline': 100,
    'ExtraLight': 200, 'UltraLight': 200,
    'Light': 300,
    'Regular': 400, 'Normal': 400,
    'Medium': 500,
    'SemiBold': 600, 'DemiBold': 600,
    'Bold': 700,
    'ExtraBold': 800, 'UltraBold': 800,
    'Black': 900, 'Heavy': 900
  }
  
  for (const [key, weight] of Object.entries(styleMap)) {
    if (style.includes(key)) return weight
  }
  return 400
}

const GOOGLE_FONTS = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Source Sans Pro', 'Nunito', 'Raleway', 'Ubuntu', 'Playfair Display',
  'Merriweather', 'Noto Sans', 'PT Sans', 'Fira Sans', 'Work Sans',
  'Rubik', 'Mulish', 'Quicksand', 'Barlow', 'Josefin Sans',
  'DM Sans', 'Manrope', 'Space Grotesk', 'Plus Jakarta Sans'
])

function isGoogleFont(family: string): boolean {
  return GOOGLE_FONTS.has(family)
}
