import postcss, { Root, Declaration, AtRule, Rule } from 'postcss'

interface FontFaceOptions {
  family: string
  weight: number
  style?: 'normal' | 'italic'
  src: string
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
}

export function createFontFace(options: FontFaceOptions): AtRule {
  const { family, weight, style = 'normal', src, display = 'swap' } = options

  const fontFace = postcss.atRule({ name: 'font-face' })
  fontFace.append(
    new Declaration({ prop: 'font-family', value: `'${family}'` }),
    new Declaration({ prop: 'font-weight', value: String(weight) }),
    new Declaration({ prop: 'font-style', value: style }),
    new Declaration({ prop: 'src', value: src }),
    new Declaration({ prop: 'font-display', value: display })
  )

  return fontFace
}

export function createFontFaceSrc(paths: Array<{ url: string; format: string }>): string {
  return paths.map((p) => `url('${p.url}') format('${p.format}')`).join(', ')
}

export function createRule(selector: string, declarations: Record<string, string | number>): Rule {
  const rule = postcss.rule({ selector })
  for (const [prop, value] of Object.entries(declarations)) {
    rule.append(new Declaration({ prop, value: String(value) }))
  }
  return rule
}

export function createRoot(): Root {
  return postcss.root()
}

export function googleFontsUrl(
  fonts: Array<{ family: string; weights: number[]; italic?: boolean }>
): string {
  const params = fonts
    .map((f) => {
      const weights = f.weights.sort((a, b) => a - b)
      if (f.italic) {
        const ital = weights.flatMap((w) => [`0,${w}`, `1,${w}`]).join(';')
        return `family=${encodeURIComponent(f.family)}:ital,wght@${ital}`
      }
      return `family=${encodeURIComponent(f.family)}:wght@${weights.join(';')}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

export function googleFontsImport(
  fonts: Array<{ family: string; weights: number[]; italic?: boolean }>
): AtRule {
  const url = googleFontsUrl(fonts)
  return postcss.atRule({ name: 'import', params: `url('${url}')` })
}
