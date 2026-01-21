import { defineCommand } from 'citty'
import { handleError, sendCommand } from '../client.ts'
import { ok, fail } from '../format.ts'
import { resolve } from 'path'
import { existsSync } from 'fs'
import * as React from 'react'
import { transformSync } from 'esbuild'
import { renderWithWidgetApi } from '../render/widget-renderer.ts'
import {
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  preloadIcons,
  collectIcons
} from '../render/index.ts'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function buildComponent(jsx: string): Function {
  const code = `
    const h = React.createElement
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse', Line = 'line', Image = 'image', SVG = 'svg'
    return function Component() { return ${jsx.trim()} }
  `
  const result = transformSync(code, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'h'
  })
  return new Function('React', result.code)(React)
}

const HELP = `
Render JSX to Figma.

EXAMPLES

  echo '<frame style={{ p: 24, bg: "#3B82F6", rounded: 12 }}>
    <text style={{ size: 18, color: "#FFF" }}>Hello</text>
  </frame>' | figma-use render --stdin

  figma-use render ./Card.figma.tsx --props '{"title": "Hello"}'

ELEMENTS

  Frame, Rectangle, Ellipse, Text, Line, Star, Polygon, Vector, Group, Icon

SHORTHANDS

  w, h          width, height
  bg            fill color
  rounded       cornerRadius
  p, px, py     padding
  flex          direction ("row" | "col")
  gap           spacing
  wrap          enable flex wrap
  size, weight  fontSize, fontWeight
  justify, items  alignment
`

export default defineCommand({
  meta: { description: 'Render JSX to Figma' },
  args: {
    examples: { type: 'boolean', description: 'Show examples' },
    file: { type: 'positional', description: 'TSX/JSX file', required: false },
    stdin: { type: 'boolean', description: 'Read from stdin' },
    props: { type: 'string', description: 'JSON props' },
    parent: { type: 'string', description: 'Parent node ID' },
    x: { type: 'string', description: 'X position' },
    y: { type: 'string', description: 'Y position' },
    export: { type: 'string', description: 'Named export' },
    json: { type: 'boolean', description: 'JSON output' }
  },
  async run({ args }) {
    if (args.examples) {
      console.log(HELP)
      return
    }

    try {
      let Component: Function

      if (args.stdin) {
        const jsx = await readStdin()
        if (!jsx.trim()) {
          console.error(fail('No input from stdin'))
          process.exit(1)
        }
        Component = buildComponent(jsx)
      } else if (args.file) {
        const filePath = resolve(args.file)
        if (!existsSync(filePath)) {
          console.error(fail(`File not found: ${filePath}`))
          process.exit(1)
        }
        const module = await import(filePath)
        Component = module[args.export || 'default']
        if (!Component) {
          console.error(fail(`Export "${args.export || 'default'}" not found`))
          process.exit(1)
        }
      } else {
        console.error(fail('Provide file or --stdin'))
        process.exit(1)
      }

      if (!isRegistryLoaded()) {
        try {
          const vars = await sendCommand<Array<{ id: string; name: string }>>('get-variables', { simple: true })
          loadVariablesIntoRegistry(vars)
        } catch {}
      }

      const props = args.props ? JSON.parse(args.props) : {}
      const element = React.createElement(Component as React.FC, props)

      const icons = collectIcons(element)
      if (icons.length > 0) {
        if (!args.json) console.log(`Preloading ${icons.length} icon(s)...`)
        await preloadIcons(icons)
      }

      const result = await renderWithWidgetApi(element as unknown, {
        parent: args.parent,
        x: args.x ? Number(args.x) : undefined,
        y: args.y ? Number(args.y) : undefined
      })

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(ok(`Rendered: ${result.id}`))
        console.log(`  name: ${result.name}`)
      }
    } catch (e) {
      handleError(e)
    }
  }
})
