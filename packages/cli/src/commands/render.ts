import { defineCommand } from 'citty'
import { consola } from 'consola'
import { handleError, getFileKey, getParentGUID, sendCommand } from '../client.ts'
import { ok, fail } from '../format.ts'
import { resolve } from 'path'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import * as React from 'react'
import {
  renderToNodeChanges,
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  resetRenderedComponents,
  getPendingComponentSetInstances,
  clearPendingComponentSetInstances,
  getPendingIcons,
  clearPendingIcons,
  preloadIcons,
  collectIcons,
  transformJsxSnippet
} from '../render/index.ts'
import { sleep } from '../retry.ts'

const PROXY_URL = process.env.FIGMA_PROXY_URL || 'http://localhost:38451'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

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



const HELP = `
Render JSX to Figma (~100x faster than plugin API).

EXAMPLES

  # From stdin (pure JSX only, no variables/logic)
  echo '<Frame style={{p: 24, bg: "#3B82F6", rounded: 12}}>
    <Text style={{size: 18, color: "#FFF"}}>Hello</Text>
  </Frame>' | figma-use render --stdin --x 100 --y 100

  # From file (supports components, variants, logic)
  figma-use render ./Card.figma.tsx
  figma-use render ./Card.figma.tsx --x 100 --y 200
  figma-use render ./Card.figma.tsx --props '{"title": "Hello"}'

COMPONENTS

  # defineComponent — first usage creates Component, rest create Instances
  const Card = defineComponent('Card', <Frame>...</Frame>)
  <Card /><Card /><Card />

  # defineComponentSet — creates Figma ComponentSet with all variants
  const Button = defineComponentSet('Button', {
    variant: ['Primary', 'Secondary'] as const,
    size: ['Small', 'Large'] as const,
  }, ({ variant, size }) => <Frame>...</Frame>)
  <Button variant="Primary" size="Large" />

VARIABLE BINDINGS

  const colors = defineVars({
    primary: { name: 'Colors/Blue/500', value: '#3B82F6' },
  })
  <Frame style={{ bg: colors.primary }} />

ICONS (150k+ from Iconify)

  <Icon icon="mdi:home" size={24} color="#3B82F6" />
  <Icon icon="lucide:star" size={32} color="#F59E0B" />

ELEMENTS

  Frame, Rectangle, Ellipse, Text, Line, Star, Polygon, Vector, Group, Icon

STYLE SHORTHANDS

  w, h          width, height
  bg            backgroundColor
  rounded       borderRadius
  p, px, py     padding, paddingLeft+Right, paddingTop+Bottom
  pt, pr, pb, pl  individual padding sides
  flex          flexDirection ("row" | "col")
  justify       justifyContent ("start" | "center" | "end" | "between")
  items         alignItems ("start" | "center" | "end" | "stretch")
  size          fontSize
  weight        fontWeight
  font          fontFamily

  Full names also work: width, backgroundColor, borderRadius, etc.

SETUP

  1. Start Figma: figma --remote-debugging-port=9222
  2. Start proxy: figma-use proxy
  3. Open plugin: Plugins → Development → Figma Use
`

export default defineCommand({
  meta: {
    description: 'Render JSX to Figma. Use --examples for API reference.'
  },
  args: {
    examples: { type: 'boolean', description: 'Show examples and API reference' },
    file: { type: 'positional', description: 'TSX/JSX file path', required: false },
    stdin: { type: 'boolean', description: 'Read TSX from stdin' },
    props: { type: 'string', description: 'JSON props to pass to component' },
    parent: { type: 'string', description: 'Parent node ID (sessionID:localID)' },
    x: { type: 'string', description: 'X position of rendered root' },
    y: { type: 'string', description: 'Y position of rendered root' },
    export: { type: 'string', description: 'Named export (default: default)' },
    json: { type: 'boolean', description: 'Output as JSON' },
    'dry-run': { type: 'boolean', description: 'Output NodeChanges without sending to Figma' }
  },
  async run({ args }) {
    if (args.examples) {
      console.log(HELP)
      return
    }

    let filePath: string
    let tempFile: string | null = null

    // Handle stdin or file
    if (args.stdin) {
      let code = await readStdin()
      if (!code.trim()) {
        console.error(fail('No input received from stdin'))
        process.exit(1)
      }

      // Transform JSX snippet to factory function
      code = transformJsxSnippet(code)

      // Write temp file
      const baseDir = findNodeModulesDir() || tmpdir()
      tempFile = join(baseDir, `.figma-render-${Date.now()}.js`)
      writeFileSync(tempFile, code)
      filePath = tempFile
    } else if (args.file) {
      filePath = resolve(args.file)

      if (!existsSync(filePath)) {
        console.error(fail(`File not found: ${filePath}`))
        process.exit(1)
      }
    } else {
      console.error(fail('Provide a file path or use --stdin'))
      process.exit(1)
    }

    try {
      // Import TSX file directly - Bun handles transpilation
      const module = await import(filePath)

      const exportName = args.export || 'default'
      let Component = module[exportName]

      // If it's a factory (from stdin wrapper), call it with React and helpers
      if (
        typeof Component === 'function' &&
        (Component.length === 1 || Component.length === 2) &&
        args.stdin
      ) {
        const { defineVars } = await import('../render/vars.ts')
        Component = Component(React, { defineVars })
      }

      if (!Component) {
        console.error(fail(`Export "${exportName}" not found`))
        process.exit(1)
      }

      // Get file key from DevTools
      let fileKey: string
      try {
        fileKey = await getFileKey()
      } catch {
        console.error(fail('Cannot connect to Chrome DevTools on port 9222'))
        console.error('')
        console.error('Start Figma with remote debugging enabled:')
        console.error('  figma --remote-debugging-port=9222')
        process.exit(1)
      }

      const parentGUID = args.parent ? parseGUID(args.parent) : await getParentGUID()

      // Use proxy for connection pooling (fast repeated renders)
      const sessionID = parentGUID.sessionID || Date.now() % 1000000

      const sendNodeChanges = async (changes: unknown[], pendingInstances?: unknown[]) => {
        const response = await fetch(`${PROXY_URL}/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileKey,
            nodeChanges: changes,
            pendingComponentSetInstances: pendingInstances
          })
        })
        const data = (await response.json()) as { error?: string }
        if (data.error) {
          throw new Error(data.error)
        }
      }

      // Load Figma variables for name resolution (if not already loaded)
      if (!isRegistryLoaded()) {
        try {
          const variables = await sendCommand<Array<{ id: string; name: string }>>(
            'get-variables',
            { simple: true }
          )
          loadVariablesIntoRegistry(variables)
        } catch {
          // Variables not available - name-based lookup will fail, ID-based still works
        }
      }

      // Create React element and render to NodeChanges
      const props = args.props ? JSON.parse(args.props) : {}
      const element = React.createElement(Component, props)

      // Collect and preload icons from the element tree
      const icons = collectIcons(element)
      if (icons.length > 0) {
        if (!args.json) {
          console.log(`Preloading ${icons.length} icon(s)...`)
        }
        await preloadIcons(icons)
      }

      // Reset rendered component tracking (but NOT the registry - it's populated by defineComponent)
      resetRenderedComponents()

      const result = renderToNodeChanges(element, {
        sessionID,
        parentGUID,
        startLocalID: Date.now() % 1000000
      })

      // Apply x/y offset to root node (coordinates are in transform matrix)
      const rootNode = result.nodeChanges[0]
      if ((args.x || args.y) && rootNode?.transform) {
        if (args.x) rootNode.transform.m02 = Number(args.x)
        if (args.y) rootNode.transform.m12 = Number(args.y)
      }

      if (args["dry-run"]) {
        console.log(JSON.stringify(result.nodeChanges, null, 2))
        return
      }

      if (!args.json) {
        console.log(`Rendering ${result.nodeChanges.length} nodes...`)
      }

      // Get pending ComponentSet instances (created via Plugin API, not multiplayer)
      const pendingInstances = getPendingComponentSetInstances()
      clearPendingComponentSetInstances()

      // Get pending icons (imported via Plugin API)
      const pendingIconsList = getPendingIcons()
      clearPendingIcons()

      // Send to Figma via proxy
      await sendNodeChanges(result.nodeChanges, pendingInstances)

      // Wait for multiplayer sync before importing icons
      // (parent nodes must be visible to Plugin API)
      if (pendingIconsList.length > 0) {
        await sleep(100)
      }

      // Import pending icons via Plugin API
      for (const icon of pendingIconsList) {
        try {
          const parentId = `${icon.parentGUID.sessionID}:${icon.parentGUID.localID}`
          await sendCommand('import-svg', {
            svg: icon.svg,
            x: icon.x,
            y: icon.y,
            parentId,
            name: icon.name,
            noFill: true,
            insertIndex: icon.childIndex
          })
        } catch (e) {
          consola.error(`Failed to import icon "${icon.name}":`, e)
        }
      }

      // Trigger layout recalculation via Plugin API (needed after icons are added)
      // Multiplayer nodes aren't immediately visible to plugin, so we call separately
      const firstNode = result.nodeChanges[0]
      if (!firstNode) {
        console.error(fail('No nodes rendered'))
        process.exit(1)
      }
      const rootId = `${firstNode.guid.sessionID}:${firstNode.guid.localID}`
      try {
        await sendCommand('trigger-layout', {
          nodeId: rootId,
          pendingComponentSetInstances: pendingInstances
        })
      } catch {
        // Plugin may not be connected, layout will be off but nodes created
      }

      // Output
      if (args.json) {
        const ids = result.nodeChanges.map((nc) => ({
          id: `${nc.guid.sessionID}:${nc.guid.localID}`,
          name: nc.name
        }))
        console.log(JSON.stringify(ids, null, 2))
      } else {
        console.log(ok(`Rendered ${result.nodeChanges.length} nodes`))
        const first = result.nodeChanges[0]
        if (first) {
          console.log(`  root: ${first.guid.sessionID}:${first.guid.localID}`)
        }
      }
    } catch (e) {
      handleError(e)
    } finally {
      // Cleanup temp file
      if (tempFile && existsSync(tempFile)) {
        unlinkSync(tempFile)
      }
    }
  }
})

function parseGUID(id: string): { sessionID: number; localID: number } {
  const parts = id.split(':').map(Number)
  return { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 }
}
