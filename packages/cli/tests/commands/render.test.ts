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

let fileKey = ''
let sessionID = 0
let parentGUID = { sessionID: 0, localID: 0 }
let localIDCounter = 1

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
    fileKey = await getFileKey()
    parentGUID = await getParentGUID()
    sessionID = parentGUID.sessionID || Date.now() % 1000000
    localIDCounter = Date.now() % 1000000
  }, 10000)

  test('renders component and returns correct node structure', async () => {
    const nodes = await renderCard({ title: 'Test', items: ['A'] })
    
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0]!.name).toBe('Card')
    expect(nodes[0]!.type).toBe('FRAME')
  })

  test('renders correct number of nodes for multiple items', async () => {
    const nodes = await renderCard({ title: 'Products', items: ['iPhone', 'MacBook', 'AirPods'] })
    // Card + Title + Items frame + 3 item frames + 3 dots + 3 texts + Actions + 2 buttons + 2 button texts = 17
    expect(nodes.length).toBe(17)
  })

  test('applies layout and styling props', async () => {
    const nodes = await renderCard({ title: 'Styled', items: ['A'] })
    const card = nodes[0]!
    
    // Check NodeChange has correct values
    expect(card.stackMode).toBe('VERTICAL')
    expect(card.stackSpacing).toBe(16)
    expect(card.cornerRadius).toBe(12)
    expect(card.fillPaints?.[0]?.color).toEqual({ r: 1, g: 1, b: 1, a: 1 }) // #FFFFFF
  })

  test('creates text nodes with content', async () => {
    const nodes = await renderCard({ title: 'Hello World', items: ['A'] })
    const titleNode = nodes.find(n => n.name === 'Title')
    
    expect(titleNode).toBeDefined()
    expect((titleNode as any).textData?.characters).toBe('Hello World')
  })

  test('handles variant prop', async () => {
    const primary = await renderCard({ title: 'P', items: ['A'] })
    const secondary = await renderCard({ title: 'S', items: ['A'], variant: 'secondary' })
    
    const primaryBtn = primary.find(n => n.name === 'Primary Button')
    const secondaryBtn = secondary.find(n => n.name === 'Primary Button')
    
    // Primary = #3B82F6, Secondary = #6B7280
    expect(primaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.96, 1) // Blue
    expect(secondaryBtn?.fillPaints?.[0]?.color?.b).toBeCloseTo(0.5, 1) // Gray
  })

  test('renders into specific parent (integration)', async () => {
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
  })
})

describe('render with variables', () => {
  test('defineVars creates variable references', async () => {
    const { defineVars, isVariable } = await import('../../src/render/index.ts')
    
    const colors = defineVars({
      primary: 'VariableID:38448:122296',
      secondary: '38448:122301', // shorthand
    })
    
    expect(isVariable(colors.primary)).toBe(true)
    expect(colors.primary.sessionID).toBe(38448)
    expect(colors.primary.localID).toBe(122296)
    expect(colors.secondary.sessionID).toBe(38448)
    expect(colors.secondary.localID).toBe(122301)
  })
  
  test('renders frame with variable backgroundColor', async () => {
    const React = (await import('react')).default
    const { renderToNodeChanges } = await import('../../src/render/index.ts')
    const { defineVars } = await import('../../src/render/vars.ts')
    
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
})
