import { writeFileSync } from 'fs'
import { join } from 'path'

import { sendCommand } from './client.ts'
import {
  createRoot,
  createFontFace,
  createFontFaceSrc,
  googleFontsImport
} from './css-builder.ts'

export interface FontInfo {
  family: string
  styles: string[]
}

let googleFontsCache: Set<string> | null = null

export async function fetchGoogleFontsList(): Promise<Set<string>> {
  if (googleFontsCache) return googleFontsCache

  try {
    const res = await fetch('https://fonts.google.com/metadata/fonts')
    const data = (await res.json()) as { familyMetadataList: Array<{ family: string }> }
    googleFontsCache = new Set(data.familyMetadataList.map((f) => f.family))
    return googleFontsCache
  } catch {
    return new Set([
      'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
      'Nunito', 'Raleway', 'Ubuntu', 'Noto Sans', 'PT Sans', 'Fira Sans'
    ])
  }
}

export function styleToWeight(style: string): number {
  const map: Record<string, number> = {
    Thin: 100, Hairline: 100,
    ExtraLight: 200, UltraLight: 200,
    Light: 300,
    Regular: 400, Normal: 400,
    Medium: 500,
    SemiBold: 600, DemiBold: 600,
    Bold: 700,
    ExtraBold: 800, UltraBold: 800,
    Black: 900, Heavy: 900
  }
  for (const [key, weight] of Object.entries(map)) {
    if (style.includes(key)) return weight
  }
  return 400
}

export async function getFonts(): Promise<FontInfo[]> {
  return (await sendCommand<FontInfo[]>('get-fonts')) || []
}

export async function generateFontsCss(fonts: FontInfo[]): Promise<string> {
  if (fonts.length === 0) return ''

  const googleFontsList = await fetchGoogleFontsList()
  const isGoogle = (family: string) => googleFontsList.has(family)

  const root = createRoot()

  // Add Google Fonts import
  const googleFonts = fonts
    .filter((f) => isGoogle(f.family))
    .map((f) => ({
      family: f.family,
      weights: f.styles.map(styleToWeight)
    }))

  if (googleFonts.length > 0) {
    root.append(googleFontsImport(googleFonts))
  }

  // Add @font-face for non-Google fonts
  for (const font of fonts) {
    if (isGoogle(font.family)) continue

    for (const style of font.styles) {
      const weight = styleToWeight(style)
      const fontStyle = style.toLowerCase().includes('italic') ? 'italic' : 'normal'
      const filename = `${font.family.replace(/\s+/g, '-')}-${style}`

      root.append(
        createFontFace({
          family: font.family,
          weight,
          style: fontStyle as 'normal' | 'italic',
          src: createFontFaceSrc([
            { url: `./fonts/${filename}.woff2`, format: 'woff2' },
            { url: `./fonts/${filename}.woff`, format: 'woff' }
          ])
        })
      )
    }
  }

  return root.toString()
}

export async function writeFontsCss(outDir: string): Promise<string | null> {
  const fonts = await getFonts()
  if (fonts.length === 0) return null

  const css = await generateFontsCss(fonts)
  if (!css) return null

  const filePath = join(outDir, 'fonts.css')
  writeFileSync(filePath, css)
  return filePath
}
