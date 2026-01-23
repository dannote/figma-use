import * as esbuild from 'esbuild'
import * as React from 'react'

import { sendCommand } from '../client.ts'
import { loadVariablesIntoRegistry, isRegistryLoaded, preloadIcons, collectIcons } from './index.ts'
import { renderWithWidgetApi } from './widget-renderer.ts'

import type { NodeRef } from '../types.ts'

const MOCK_RENDER_MODULE = `
  export const Frame = 'frame'
  export const Text = 'text'
  export const Rectangle = 'rectangle'
  export const Ellipse = 'ellipse'
  export const Line = 'line'
  export const Image = 'image'
  export const SVG = 'svg'
  export const Icon = (props) => ({ __icon: true, name: props.name, size: props.size, color: props.color })
  export const View = 'frame'
  export const Rect = 'rectangle'
  export const Section = 'section'
  export const Group = 'group'
  export const defineComponent = (name, el) => () => el
  export const defineVars = (vars) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.value]))
`

export async function buildComponent(input: string): Promise<Function> {
  let code = input.trim()

  // Pure JSX snippet (no import/export) - wrap it
  if (!code.includes('import ') && !code.includes('export ')) {
    code = `import { Frame, Text, Rectangle, Ellipse, Line, Image, SVG, Icon } from 'figma-use/render'
export default () => ${code}`
  }
  // Has imports but no export
  else if (!code.includes('export ')) {
    code = `${code}\nexport default () => null`
  }

  const result = await esbuild.build({
    stdin: { contents: code, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: '__mod',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    plugins: [
      {
        name: 'mock-imports',
        setup(build) {
          build.onResolve({ filter: /^figma-use\/render$|^\./ }, (args) => ({
            path: args.path,
            namespace: 'mock'
          }))
          build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
            contents: MOCK_RENDER_MODULE,
            loader: 'js'
          }))
        }
      }
    ]
  })

  const bundled = result.outputFiles![0]!.text
  const fn = new Function('React', `${bundled}; return __mod.default`)
  return fn(React)
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

interface RenderOptions {
  x?: number
  y?: number
  parent?: string
  props?: Record<string, unknown>
}

interface RenderResult {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export async function renderFromString(
  jsx: string,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const Component = await buildComponent(jsx)

  if (!isRegistryLoaded()) {
    try {
      const vars = await sendCommand<NodeRef[]>('get-variables', { simple: true })
      loadVariablesIntoRegistry(vars)
    } catch {}
  }

  const props = options.props ?? {}
  const element = React.createElement(Component as React.FC, props)

  const icons = collectIcons(element)
  if (icons.length > 0) {
    await preloadIcons(icons)
  }

  return (await renderWithWidgetApi(element as unknown, {
    parent: options.parent,
    x: options.x,
    y: options.y
  })) as RenderResult
}
