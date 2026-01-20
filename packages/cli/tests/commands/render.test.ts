/**
 * Render tests using proxy connection pooling
 */
import { describe, test, expect, beforeAll } from 'bun:test'
import * as React from 'react'
import { run } from '../helpers.ts'
import { renderToNodeChanges } from '../../src/render/index.ts'
import { getFileKey, getParentGUID } from '../../src/client.ts'

import Card from '../fixtures/Card.figma.tsx'

const PROXY_URL = 'http://localhost:38451'
const RENDER_TIMEOUT = 20000

let fileKey = ''
let sessionID = 0
let parentGUID = { sessionID: 0, localID: 0 }
let localIDCounter = 1
let renderReady = true

async function sendToProxy(nodeChanges: unknown[]): Promise<void> {
  const response = await fetch(`${PROXY_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileKey, nodeChanges })
  })
  const data = (await response.json()) as { error?: string }
  if (data.error) throw new Error(data.error)
}

async function renderCard(props: Record<string, unknown>) {
  const element = React.createElement(Card, props as any)
  const result = renderToNodeChanges(element, {
    sessionID,
    parentGUID,
    startLocalID: localIDCounter
  })
  localIDCounter = result.nextLocalID
  await sendToProxy(result.nodeChanges)
  return result.nodeChanges
}

describe('render', () => {
  beforeAll(async () => {
    try {
      fileKey = await getFileKey()
      parentGUID = await getParentGUID()
      sessionID = parentGUID.sessionID || Date.now() % 1000000
      localIDCounter = Date.now() % 1000000
    } catch (error) {
      renderReady = false
      console.warn('Skipping render tests - DevTools or plugin not available', error)
    }
  }, 20000)

  test(
    'renders component and returns correct node structure',
    async () => {
      if (!renderReady) return
      const nodes = await renderCard({ title: 'Test', items: ['A'] })

      expect(nodes.length).toBeGreaterThan(0)
      expect(nodes[0]!.name).toBe('Card')
      expect(nodes[0]!.type).toBe('FRAME')
    },
    RENDER_TIMEOUT
  )

  test(
    'renders correct number of nodes for multiple items',
    async () => {
      if (!renderReady) return
      const nodes = await renderCard({ title: 'Products', items: ['iPhone', 'MacBook', 'AirPods'] })
      // Card + Title + Items frame + 3 item frames + 3 dots + 3 texts + Actions + 2 buttons + 2 button texts = 17
      expect(nodes.length).toBe(17)
    },
    RENDER_TIMEOUT
  )

  test(
    'applies layout and styling props',
    async () => {
      if (!renderReady) return
      const nodes = await renderCard({ title: 'Styled', items: ['A'] })
      const card = nodes[0]!

      // Check NodeChange has correct values
      expect(card.stackMode).toBe('VERTICAL')
      expect(card.stackSpacing).toBe(16)
      expect(card.cornerRadius).toBe(12)
      expect(card.fillPaints?.[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 }) // #FFFFFF
    },
    RENDER_TIMEOUT
  )

  test(
    'creates text nodes with content',
    async () => {
      if (!renderReady) return
      const nodes = await renderCard({ title: 'Hello World', items: ['A'] })
      const titleNode = nodes.find((n) => n.name === 'Title')

      expect(titleNode).toBeDefined()
      expect((titleNode as any).textData?.characters).toBe('Hello World')
    },
    RENDER_TIMEOUT
  )

  test(
    'handles variant prop',
    async () => {
      if (!renderReady) return
      const primary = await renderCard({ title: 'P', items: ['A'] })
      const secondary = await renderCard({ title: 'S', items: ['A'], variant: 'secondary' })

      const primaryBtn = primary.find((n) => n.name === 'Primary Button')
      const secondaryBtn = secondary.find((n) => n.name === 'Primary Button')

      // Primary = #3B82F6, Secondary = #6B7280
      expect(primaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.96, 1) // Blue
      expect(secondaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.5, 1) // Gray
    },
    RENDER_TIMEOUT
  )

  test(
    'renders into specific parent (integration)',
    async () => {
      if (!renderReady) return
      // This test actually verifies via plugin - keep one integration test
      const parent = (await run(
        'create frame --x 0 --y 0 --width 500 --height 500 --name "Container" --json'
      )) as { id: string }
      const parts = parent.id.split(':').map(Number)

      const element = React.createElement(Card, { title: 'Nested', items: ['X'] })
      const result = renderToNodeChanges(element, {
        sessionID,
        parentGUID: { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 },
        startLocalID: localIDCounter++
      })
      localIDCounter = result.nextLocalID

      await sendToProxy(result.nodeChanges)

      const cardId = `${result.nodeChanges[0]!.guid.sessionID}:${result.nodeChanges[0]!.guid.localID}`
      const cardInfo = (await run(`node get ${cardId} --json`)) as { parentId?: string }
      expect(cardInfo.parentId).toBe(parent.id)
    },
    RENDER_TIMEOUT
  )
})

describe('render auto-layout (hug contents)', () => {
  let alSessionID = 0
  let alParentGUID = { sessionID: 0, localID: 0 }

  beforeAll(async () => {
    if (!renderReady) return
    try {
      if (!fileKey) fileKey = await getFileKey()
      alParentGUID = await getParentGUID()
      alSessionID = alParentGUID.sessionID || Date.now() % 1000000
    } catch (error) {
      renderReady = false
      console.warn('Skipping render auto-layout tests - DevTools or plugin not available', error)
    }
  }, 20000)

  // Helper to create React element and render via proxy + trigger-layout
  async function renderFrameWithLayout(
    name: string,
    style: Record<string, unknown>,
    children: Array<{ style: Record<string, unknown> }>
  ): Promise<string> {
    const { sendCommand } = await import('../../src/client.ts')

    const childElements = children.map((child, i) =>
      React.createElement('frame', { key: i, style: child.style })
    )
    const element = React.createElement('frame', { name, style }, ...childElements)

    // Use unique localID for each render to avoid collisions
    const uniqueLocalID = Math.floor(Math.random() * 900000) + 100000

    const result = renderToNodeChanges(element, {
      sessionID: alSessionID,
      parentGUID: alParentGUID,
      startLocalID: uniqueLocalID
    })

    await sendToProxy(result.nodeChanges)

    const rootId = `${result.nodeChanges[0]!.guid.sessionID}:${result.nodeChanges[0]!.guid.localID}`
    await sendCommand('trigger-layout', { nodeId: rootId })

    return rootId
  }

  test(
    'column layout calculates height from children',
    async () => {
      if (!renderReady) return
      const rootId = await renderFrameWithLayout(
        'AutoCol',
        { width: 200, flexDirection: 'column', backgroundColor: '#FF0000' },
        [
          { style: { width: 200, height: 50, backgroundColor: '#00FF00' } },
          { style: { width: 200, height: 30, backgroundColor: '#0000FF' } }
        ]
      )

      const node = (await run(`node get ${rootId} --json`)) as { width: number; height: number }
      expect(node.width).toBe(200)
      expect(node.height).toBe(80) // 50 + 30
    },
    RENDER_TIMEOUT
  )

  test(
    'column layout with gap calculates height correctly',
    async () => {
      if (!renderReady) return
      const rootId = await renderFrameWithLayout(
        'AutoColGap',
        { width: 200, flexDirection: 'column', gap: 10, backgroundColor: '#FF0000' },
        [
          { style: { width: 200, height: 50, backgroundColor: '#00FF00' } },
          { style: { width: 200, height: 50, backgroundColor: '#0000FF' } }
        ]
      )

      const node = (await run(`node get ${rootId} --json`)) as { width: number; height: number }
      expect(node.width).toBe(200)
      expect(node.height).toBe(110) // 50 + 10 + 50
    },
    RENDER_TIMEOUT
  )

  test(
    'column layout with padding calculates height correctly',
    async () => {
      if (!renderReady) return
      const rootId = await renderFrameWithLayout(
        'AutoColPad',
        { width: 200, padding: 20, flexDirection: 'column', backgroundColor: '#FF0000' },
        [{ style: { width: 160, height: 50, backgroundColor: '#00FF00' } }]
      )

      const node = (await run(`node get ${rootId} --json`)) as { width: number; height: number }
      expect(node.width).toBe(200)
      expect(node.height).toBe(90) // 20 + 50 + 20
    },
    RENDER_TIMEOUT
  )

  test(
    'row layout with explicit width works',
    async () => {
      if (!renderReady) return
      const rootId = await renderFrameWithLayout(
        'AutoRow',
        { width: 300, flexDirection: 'row', gap: 20, backgroundColor: '#FF0000' },
        [
          { style: { width: 100, height: 80, backgroundColor: '#00FF00' } },
          { style: { width: 100, height: 60, backgroundColor: '#0000FF' } }
        ]
      )

      const node = (await run(`node get ${rootId} --json`)) as { width: number; height: number }
      expect(node.width).toBe(300)
      expect(node.height).toBe(80) // Max child height
    },
    RENDER_TIMEOUT
  )
})

describe('render with icons', () => {
  test('preloadIcons loads icon data', async () => {
    const { preloadIcons, getIconData } = await import('../../src/render/index.ts')

    await preloadIcons([{ name: 'mdi:home', size: 24 }])

    const iconData = getIconData('mdi:home', 24)
    expect(iconData).not.toBeNull()
    expect(iconData?.width).toBe(24)
    expect(iconData?.height).toBe(24)
    expect(iconData?.svg).toContain('<svg')
    expect(iconData?.svg).toContain('</svg>')
  })

  test('collectIcons finds icon primitives in element tree', async () => {
    const { collectIcons } = await import('../../src/render/index.ts')
    const React = (await import('react')).default

    const element = React.createElement(
      'frame',
      { name: 'Test' },
      React.createElement('icon', { icon: 'mdi:home', size: 24 }),
      React.createElement('icon', { icon: 'lucide:star', size: 32 }),
      React.createElement('frame', null, React.createElement('icon', { icon: 'heroicons:heart-solid' }))
    )

    const icons = collectIcons(element)
    expect(icons).toHaveLength(3)
    expect(icons[0]).toEqual({ name: 'mdi:home', size: 24 })
    expect(icons[1]).toEqual({ name: 'lucide:star', size: 32 })
    expect(icons[2]).toEqual({ name: 'heroicons:heart-solid', size: undefined })
  })

  test(
    'renders frame with icon children',
    async () => {
      if (!renderReady) return
      const { preloadIcons, renderToNodeChanges, getPendingIcons, clearPendingIcons } =
        await import('../../src/render/index.ts')
      const React = (await import('react')).default

      // Preload icon
      await preloadIcons([{ name: 'mdi:home', size: 24 }])
      clearPendingIcons()

      const element = React.createElement(
        'frame',
        { name: 'IconFrame', style: { width: 100, height: 100 } },
        React.createElement('icon', { icon: 'mdi:home', size: 24, color: '#3B82F6' })
      )

      const result = renderToNodeChanges(element, {
        sessionID,
        parentGUID,
        startLocalID: Date.now() % 1000000
      })

      // Frame node created
      expect(result.nodeChanges).toHaveLength(1)
      expect(result.nodeChanges[0]!.name).toBe('IconFrame')

      // Icon added to pending
      const pending = getPendingIcons()
      expect(pending).toHaveLength(1)
      expect(pending[0]!.name).toBe('mdi/home')
      expect(pending[0]!.svg).toContain('#3B82F6')
    },
    RENDER_TIMEOUT
  )
})

describe('render with variables', () => {
  test('defineVars creates variable references', async () => {
    const { defineVars, isVariable } = await import('../../src/render/index.ts')

    const colors = defineVars({
      primary: 'Colors/Gray/50',
      secondary: 'Colors/Gray/500'
    })

    expect(isVariable(colors.primary)).toBe(true)
    expect(colors.primary.name).toBe('Colors/Gray/50')
    expect(colors.secondary.name).toBe('Colors/Gray/500')
  })

  test('renders frame with variable backgroundColor (ID format)', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges, defineVars } = await import('../../src/render/index.ts')

    // Legacy ID format still works without registry
    const colors = defineVars({
      primary: 'VariableID:38448:122296'
    })

    const element = React.createElement('frame', {
      name: 'VarFrame',
      style: { backgroundColor: colors.primary, width: 100, height: 100 }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    expect(result.nodeChanges).toHaveLength(1)
    const node = result.nodeChanges[0]!
    expect(node.fillPaints?.[0]?.colorVariableBinding).toBeDefined()
    expect(node.fillPaints?.[0]?.colorVariableBinding?.variableID).toEqual({
      sessionID: 38448,
      localID: 122296
    })
  })

  test('renders frame with variable by name', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges, defineVars, loadVariablesIntoRegistry } =
      await import('../../src/render/index.ts')

    // Load mock variables into registry
    loadVariablesIntoRegistry([
      { id: 'VariableID:38448:122296', name: 'Colors/Gray/50' },
      { id: 'VariableID:38448:122301', name: 'Colors/Gray/500' }
    ])

    const colors = defineVars({
      primary: 'Colors/Gray/50'
    })

    const element = React.createElement('frame', {
      name: 'VarFrame',
      style: { backgroundColor: colors.primary, width: 100, height: 100 }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    expect(result.nodeChanges).toHaveLength(1)
    const node = result.nodeChanges[0]!
    expect(node.fillPaints?.[0]?.colorVariableBinding?.variableID).toEqual({
      sessionID: 38448,
      localID: 122296
    })
  })
})

describe('render with grid layout', () => {
  let gridSessionID = 0
  let gridParentGUID = { sessionID: 0, localID: 0 }

  beforeAll(async () => {
    if (!renderReady) return
    try {
      if (!fileKey) fileKey = await getFileKey()
      gridParentGUID = await getParentGUID()
      gridSessionID = gridParentGUID.sessionID || Date.now() % 1000000
    } catch (error) {
      renderReady = false
      console.warn('Skipping render grid tests - DevTools or plugin not available', error)
    }
  }, 20000)

  test('grid layout sets stackMode to GRID', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges } = await import('../../src/render/index.ts')

    const element = React.createElement('frame', {
      name: 'GridFrame',
      style: { display: 'grid', width: 300, height: 200 }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    expect(result.nodeChanges).toHaveLength(1)
    expect(result.nodeChanges[0]!.stackMode).toBe('GRID')
  })

  test('grid layout with cols/rows triggers pending grid layout', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges, getPendingGridLayouts, clearPendingGridLayouts } =
      await import('../../src/render/index.ts')

    clearPendingGridLayouts()

    const element = React.createElement('frame', {
      name: 'GridWithTemplate',
      style: {
        display: 'grid',
        cols: '100px 1fr 100px',
        rows: 'auto auto',
        width: 400,
        height: 200
      }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    const pending = getPendingGridLayouts()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.gridTemplateColumns).toBe('100px 1fr 100px')
    expect(pending[0]!.gridTemplateRows).toBe('auto auto')
  })

  test('grid gap sets gridColumnGap and gridRowGap', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges } = await import('../../src/render/index.ts')

    const element = React.createElement('frame', {
      name: 'GridWithGap',
      style: { display: 'grid', gap: 16, width: 300, height: 200 }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    expect(result.nodeChanges[0]!.gridColumnGap).toBe(16)
    expect(result.nodeChanges[0]!.gridRowGap).toBe(16)
  })

  test('grid with separate colGap and rowGap', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges } = await import('../../src/render/index.ts')

    const element = React.createElement('frame', {
      name: 'GridWithSeparateGaps',
      style: { display: 'grid', colGap: 24, rowGap: 12, width: 300, height: 200 }
    })

    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 }
    })

    expect(result.nodeChanges[0]!.gridColumnGap).toBe(24)
    expect(result.nodeChanges[0]!.gridRowGap).toBe(12)
  })

  test(
    'grid integration: renders grid with children',
    async () => {
      if (!renderReady) return
      const React = (await import('react')).default
      const { renderToNodeChanges, clearPendingGridLayouts } = await import('../../src/render/index.ts')
      const { sendCommand } = await import('../../src/client.ts')

      clearPendingGridLayouts()

      const element = React.createElement(
        'frame',
        {
          name: 'IntegrationGrid',
          style: {
            display: 'grid',
            cols: '100px 1fr',
            rows: 'auto',
            gap: 10,
            width: 300,
            height: 100
          }
        },
        React.createElement('rectangle', { name: 'Cell1', style: { width: 50, height: 50, bg: '#FF0000' } }),
        React.createElement('rectangle', { name: 'Cell2', style: { width: 50, height: 50, bg: '#00FF00' } })
      )

      const uniqueLocalID = Math.floor(Math.random() * 900000) + 100000
      const result = renderToNodeChanges(element, {
        sessionID: gridSessionID,
        parentGUID: gridParentGUID,
        startLocalID: uniqueLocalID
      })

      await sendToProxy(result.nodeChanges)

      const rootId = `${result.nodeChanges[0]!.guid.sessionID}:${result.nodeChanges[0]!.guid.localID}`
      
      // Trigger layout with pending grid layouts
      const { getPendingGridLayouts } = await import('../../src/render/index.ts')
      await sendCommand('trigger-layout', {
        nodeId: rootId,
        pendingGridLayouts: getPendingGridLayouts()
      })

      // Verify via plugin
      const node = (await run(`eval "const n = await figma.getNodeByIdAsync('${rootId}'); return { layoutMode: n.layoutMode, gridColumnCount: n.gridColumnCount, gridColumnGap: n.gridColumnGap }"`)) as any

      expect(node.layoutMode).toBe('GRID')
      expect(node.gridColumnCount).toBe(2)
      expect(node.gridColumnGap).toBe(10)
    },
    RENDER_TIMEOUT
  )
})
