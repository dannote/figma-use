/**
 * Render tests using proxy connection pooling
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
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
    body: JSON.stringify({ fileKey, nodeChanges }),
  })
  const data = await response.json() as { error?: string }
  if (data.error) throw new Error(data.error)
}

async function renderCard(props: Record<string, unknown>) {
  const element = React.createElement(Card, props as any)
  const result = renderToNodeChanges(element, {
    sessionID,
    parentGUID,
    startLocalID: localIDCounter,
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

  test('renders component and returns correct node structure', async () => {
    if (!renderReady) return
    const nodes = await renderCard({ title: 'Test', items: ['A'] })
    
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0]!.name).toBe('Card')
    expect(nodes[0]!.type).toBe('FRAME')
  }, RENDER_TIMEOUT)

  test('renders correct number of nodes for multiple items', async () => {
    if (!renderReady) return
    const nodes = await renderCard({ title: 'Products', items: ['iPhone', 'MacBook', 'AirPods'] })
    // Card + Title + Items frame + 3 item frames + 3 dots + 3 texts + Actions + 2 buttons + 2 button texts = 17
    expect(nodes.length).toBe(17)
  }, RENDER_TIMEOUT)

  test('applies layout and styling props', async () => {
    if (!renderReady) return
    const nodes = await renderCard({ title: 'Styled', items: ['A'] })
    const card = nodes[0]!
    
    // Check NodeChange has correct values
    expect(card.stackMode).toBe('VERTICAL')
    expect(card.stackSpacing).toBe(16)
    expect(card.cornerRadius).toBe(12)
    expect(card.fillPaints?.[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 }) // #FFFFFF
  }, RENDER_TIMEOUT)

  test('creates text nodes with content', async () => {
    if (!renderReady) return
    const nodes = await renderCard({ title: 'Hello World', items: ['A'] })
    const titleNode = nodes.find(n => n.name === 'Title')
    
    expect(titleNode).toBeDefined()
    expect((titleNode as any).textData?.characters).toBe('Hello World')
  }, RENDER_TIMEOUT)

  test('handles variant prop', async () => {
    if (!renderReady) return
    const primary = await renderCard({ title: 'P', items: ['A'] })
    const secondary = await renderCard({ title: 'S', items: ['A'], variant: 'secondary' })
    
    const primaryBtn = primary.find(n => n.name === 'Primary Button')
    const secondaryBtn = secondary.find(n => n.name === 'Primary Button')
    
    // Primary = #3B82F6, Secondary = #6B7280
    expect(primaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.96, 1) // Blue
    expect(secondaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.5, 1) // Gray
  }, RENDER_TIMEOUT)

  test('renders into specific parent (integration)', async () => {
    if (!renderReady) return
    // This test actually verifies via plugin - keep one integration test
    const parent = await run('create frame --x 0 --y 0 --width 500 --height 500 --name "Container" --json') as { id: string }
    const parts = parent.id.split(':').map(Number)
    
    const element = React.createElement(Card, { title: 'Nested', items: ['X'] })
    const result = renderToNodeChanges(element, {
      sessionID,
      parentGUID: { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 },
      startLocalID: localIDCounter++,
    })
    localIDCounter = result.nextLocalID
    
    await sendToProxy(result.nodeChanges)
    
    const cardId = `${result.nodeChanges[0]!.guid.sessionID}:${result.nodeChanges[0]!.guid.localID}`
    const cardInfo = await run(`node get ${cardId} --json`) as { parentId?: string }
    expect(cardInfo.parentId).toBe(parent.id)
  }, RENDER_TIMEOUT)
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
      startLocalID: uniqueLocalID,
    })
    
    await sendToProxy(result.nodeChanges)
    
    const rootId = `${result.nodeChanges[0]!.guid.sessionID}:${result.nodeChanges[0]!.guid.localID}`
    await sendCommand('trigger-layout', { nodeId: rootId })
    
    return rootId
  }

  test('column layout calculates height from children', async () => {
    if (!renderReady) return
    const rootId = await renderFrameWithLayout(
      'AutoCol',
      { width: 200, flexDirection: 'column', backgroundColor: '#FF0000' },
      [
        { style: { width: 200, height: 50, backgroundColor: '#00FF00' } },
        { style: { width: 200, height: 30, backgroundColor: '#0000FF' } },
      ]
    )
    
    const node = await run(`node get ${rootId} --json`) as { width: number; height: number }
    expect(node.width).toBe(200)
    expect(node.height).toBe(80) // 50 + 30
  }, RENDER_TIMEOUT)

  test('column layout with gap calculates height correctly', async () => {
    if (!renderReady) return
    const rootId = await renderFrameWithLayout(
      'AutoColGap',
      { width: 200, flexDirection: 'column', gap: 10, backgroundColor: '#FF0000' },
      [
        { style: { width: 200, height: 50, backgroundColor: '#00FF00' } },
        { style: { width: 200, height: 50, backgroundColor: '#0000FF' } },
      ]
    )
    
    const node = await run(`node get ${rootId} --json`) as { width: number; height: number }
    expect(node.width).toBe(200)
    expect(node.height).toBe(110) // 50 + 10 + 50
  }, RENDER_TIMEOUT)

  test('column layout with padding calculates height correctly', async () => {
    if (!renderReady) return
    const rootId = await renderFrameWithLayout(
      'AutoColPad',
      { width: 200, padding: 20, flexDirection: 'column', backgroundColor: '#FF0000' },
      [
        { style: { width: 160, height: 50, backgroundColor: '#00FF00' } },
      ]
    )
    
    const node = await run(`node get ${rootId} --json`) as { width: number; height: number }
    expect(node.width).toBe(200)
    expect(node.height).toBe(90) // 20 + 50 + 20
  }, RENDER_TIMEOUT)

  test('row layout with explicit width works', async () => {
    if (!renderReady) return
    const rootId = await renderFrameWithLayout(
      'AutoRow',
      { width: 300, flexDirection: 'row', gap: 20, backgroundColor: '#FF0000' },
      [
        { style: { width: 100, height: 80, backgroundColor: '#00FF00' } },
        { style: { width: 100, height: 60, backgroundColor: '#0000FF' } },
      ]
    )
    
    const node = await run(`node get ${rootId} --json`) as { width: number; height: number }
    expect(node.width).toBe(300)
    expect(node.height).toBe(80) // Max child height
  }, RENDER_TIMEOUT)
})

describe('render with variables', () => {
  test('defineVars creates variable references', async () => {
    const { defineVars, isVariable } = await import('../../src/render/index.ts')
    
    const colors = defineVars({
      primary: 'Colors/Gray/50',
      secondary: 'Colors/Gray/500',
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
      primary: 'VariableID:38448:122296',
    })
    
    const element = React.createElement('frame', {
      name: 'VarFrame',
      style: { backgroundColor: colors.primary, width: 100, height: 100 }
    })
    
    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 },
    })
    
    expect(result.nodeChanges).toHaveLength(1)
    const node = result.nodeChanges[0]
    expect(node.fillPaints?.[0]?.colorVariableBinding).toBeDefined()
    expect(node.fillPaints?.[0]?.colorVariableBinding?.variableID).toEqual({
      sessionID: 38448,
      localID: 122296,
    })
  })
  
  test('renders frame with variable by name', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges, defineVars, loadVariablesIntoRegistry } = await import('../../src/render/index.ts')
    
    // Load mock variables into registry
    loadVariablesIntoRegistry([
      { id: 'VariableID:38448:122296', name: 'Colors/Gray/50' },
      { id: 'VariableID:38448:122301', name: 'Colors/Gray/500' },
    ])
    
    const colors = defineVars({
      primary: 'Colors/Gray/50',
    })
    
    const element = React.createElement('frame', {
      name: 'VarFrame',
      style: { backgroundColor: colors.primary, width: 100, height: 100 }
    })
    
    const result = renderToNodeChanges(element, {
      sessionID: 1,
      parentGUID: { sessionID: 1, localID: 1 },
    })
    
    expect(result.nodeChanges).toHaveLength(1)
    const node = result.nodeChanges[0]
    expect(node.fillPaints?.[0]?.colorVariableBinding?.variableID).toEqual({
      sessionID: 38448,
      localID: 122296,
    })
  })
})
