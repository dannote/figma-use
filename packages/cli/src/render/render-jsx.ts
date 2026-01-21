import { transformSync } from 'esbuild'
import * as React from 'react'

import { sendCommand } from '../client.ts'
import { loadVariablesIntoRegistry, isRegistryLoaded, preloadIcons, collectIcons } from './index.ts'
import { renderWithWidgetApi } from './widget-renderer.ts'

function buildComponent(jsx: string): React.FC {
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
  return new Function('React', result.code)(React) as React.FC
}

export async function renderJsx(
  jsx: string,
  options?: { x?: number; y?: number; parent?: string }
): Promise<Array<{ id: string; name: string }>> {
  const Component = buildComponent(jsx)

  if (!isRegistryLoaded()) {
    try {
      const vars = await sendCommand<Array<{ id: string; name: string }>>('get-variables', {
        simple: true
      })
      loadVariablesIntoRegistry(vars)
    } catch {}
  }

  const element = React.createElement(Component)

  const icons = collectIcons(element)
  if (icons.length > 0) await preloadIcons(icons)

  const result = await renderWithWidgetApi(element, options)
  return [result]
}
