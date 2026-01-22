import { defineCommand } from 'citty'
import { existsSync } from 'fs'
import { resolve } from 'path'
import * as React from 'react'

import { handleError, sendCommand } from '../client.ts'
import { ok, fail } from '../format.ts'
import {
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  preloadIcons,
  collectIcons,
  readStdin,
  buildComponent
} from '../render/index.ts'
import { renderWithWidgetApi } from '../render/widget-renderer.ts'

const HELP = `
Render JSX to Figma.

EXAMPLES

  echo '<Frame w={200} h={100} bg="#3B82F6" rounded={12} p={24}>
    <Text size={18} color="#FFF">Hello</Text>
  </Frame>' | figma-use render --stdin

  figma-use render ./Card.figma.tsx --props '{"title": "Hello"}'

ELEMENTS

  Frame, Rectangle, Ellipse, Text, Line, Image, SVG, Icon, Instance

SIZE & POSITION

  w, h            width, height (number or "fill")
  minW, maxW      min/max width constraints
  minH, maxH      min/max height constraints
  x, y            position

LAYOUT (Auto-layout)

  flex            direction ("row" | "col")
  gap             spacing between items
  wrap            enable flex wrap
  justify         main axis: "start" | "center" | "end" | "between"
  items           cross axis: "start" | "center" | "end"
  p, px, py       padding (all, x-axis, y-axis)
  pt, pr, pb, pl  padding (top, right, bottom, left)
  position        "absolute" for absolute positioning
  grow            flex grow
  stretch         stretch to fill cross-axis

APPEARANCE

  bg              fill color (#HEX or var:Name)
  stroke          stroke color
  strokeWidth     stroke thickness
  strokeAlign     "inside" | "outside" | "center"
  opacity         0..1 opacity
  blendMode       blend mode (multiply, overlay, etc.)

CORNERS

  rounded         corner radius (all corners)
  roundedTL/TR/BL/BR  individual corner radii
  cornerSmoothing iOS squircle smoothing (0..1)

EFFECTS

  shadow          drop shadow ("Xpx Ypx Rpx color")
  blur            layer blur radius
  overflow        "hidden" to clip content
  rotate          rotation in degrees

TEXT

  size            font size
  font            font family
  weight          font weight (400, 500, "bold")
  color           text color
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
        Component = await buildComponent(jsx)
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
          const vars = await sendCommand<Array<{ id: string; name: string }>>('get-variables', {
            simple: true
          })
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
