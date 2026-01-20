import * as React from 'react'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { sendCommand } from '../client.ts'
import { renderToBatchCommands } from './batch-reconciler.ts'
import {
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  preloadIcons,
  collectIcons,
  transformJsxSnippet
} from './index.ts'

function findNodeModulesDir(): string | null {
  let dir = import.meta.dir
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'node_modules', 'react'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

export async function renderJsx(
  jsx: string,
  options?: {
    x?: number
    y?: number
    parent?: string
  }
): Promise<Array<{ id: string; name: string }>> {
  // Transform JSX snippet to factory function
  const code = transformJsxSnippet(jsx)

  // Write temp file
  const baseDir = findNodeModulesDir() || tmpdir()
  const tempFile = join(baseDir, `.figma-render-${Date.now()}.js`)
  writeFileSync(tempFile, code)

  try {
    // Import and execute
    const module = await import(tempFile)
    let Component = module.default

    // If it's a factory (from stdin wrapper), call it with React and helpers
    if (typeof Component === 'function' && (Component.length === 1 || Component.length === 2)) {
      const { defineVars } = await import('./vars.ts')
      Component = Component(React, { defineVars })
    }

    if (!Component) {
      throw new Error('No default export found')
    }

    // Load Figma variables for name resolution
    if (!isRegistryLoaded()) {
      try {
        const variables = await sendCommand<Array<{ id: string; name: string }>>(
          'get-variables',
          { simple: true }
        )
        loadVariablesIntoRegistry(variables)
      } catch {
        // Variables not available
      }
    }

    // Create React element
    const element = React.createElement(Component, {})

    // Preload icons
    const icons = collectIcons(element)
    if (icons.length > 0) {
      await preloadIcons(icons)
    }

    // Render to batch commands
    const result = renderToBatchCommands(element, {
      parentId: options?.parent,
      x: options?.x,
      y: options?.y
    })

    // Send batch to Figma
    const batchResult = await sendCommand<Array<{ id: string; name: string }>>('batch', {
      commands: result.commands
    })

    return batchResult
  } finally {
    if (existsSync(tempFile)) {
      unlinkSync(tempFile)
    }
  }
}
