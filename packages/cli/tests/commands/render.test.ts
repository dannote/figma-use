/**
 * Render tests via CLI (CDP-based)
 *
 * Uses Widget API (createNodeFromJSXAsync) for rendering.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('render', () => {
  let testFrameId: string

  beforeAll(async () => {
    await setupTestPage('render')
    const frame = (await run(
      'create frame --x 0 --y 0 --width 1200 --height 800 --name "Render Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)
  }, 30000)

  afterAll(async () => {
    await teardownTestPage()
  })

  test('renders component and returns root node', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Test","items":["A"]}' --parent "${testFrameId}" --json`
    )) as { id: string; name: string }

    expect(result.id).toBeDefined()
    expect(result.name).toBe('Card')
    trackNode(result.id)
  }, 30000)

  test('renders nested children correctly', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Products","items":["iPhone","MacBook","AirPods"]}' --parent "${testFrameId}" --x 350 --json`
    )) as { id: string; name: string }

    expect(result.name).toBe('Card')
    trackNode(result.id)

    // Verify children were created
    const tree = (await run(`node tree ${result.id} --json`)) as {
      children?: Array<{ name: string }>
    }
    expect(tree.children).toBeDefined()
    expect(tree.children!.length).toBeGreaterThan(0)
  }, 30000)

  test('applies layout and styling props', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Styled","items":["A"]}' --parent "${testFrameId}" --x 700 --json`
    )) as { id: string; name: string }

    expect(result.name).toBe('Card')
    trackNode(result.id)

    // Verify via node get
    const cardInfo = (await run(`node get ${result.id} --json`)) as {
      layoutMode?: string
      itemSpacing?: number
      cornerRadius?: number
      fills?: Array<{ color: string }>
    }

    expect(cardInfo.layoutMode).toBe('VERTICAL')
    expect(cardInfo.itemSpacing).toBe(16)
    expect(cardInfo.cornerRadius).toBe(12)
    expect(cardInfo.fills?.[0]?.color).toBe('#FFFFFF')
  }, 30000)

  test('creates text nodes with content', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Hello World","items":["A"]}' --parent "${testFrameId}" --x 1050 --json`
    )) as { id: string; name: string }

    trackNode(result.id)

    // Find title in tree
    const tree = (await run(`node tree ${result.id} --depth 3 --json`)) as {
      children?: Array<{
        name: string
        characters?: string
        children?: Array<{ characters?: string }>
      }>
    }

    // Title should be in children
    const titleNode = tree.children?.find((c) => c.name === 'Title')
    expect(titleNode).toBeDefined()
    expect(titleNode!.characters).toBe('Hello World')
  }, 30000)

  test('renders into specific parent', async () => {
    const container = (await run(
      `create frame --x 0 --y 400 --width 400 --height 300 --name "Container" --parent "${testFrameId}" --json`
    )) as { id: string }
    trackNode(container.id)

    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Nested","items":["X"]}' --parent "${container.id}" --json`
    )) as { id: string; name: string }

    expect(result.name).toBe('Card')

    // Verify parent
    const cardInfo = (await run(`node get ${result.id} --json`)) as { parentId?: string }
    expect(cardInfo.parentId).toBe(container.id)
  }, 30000)
})

describe('render from file', () => {
  test('renders existing fixture file', async () => {
    const { run, trackNode } = await import('../helpers.ts')

    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"FileTest","items":["A"]}' --json`
    )) as { id: string; name: string }
    expect(result.id).toBeDefined()
    expect(result.name).toBe('Card')
    trackNode(result.id)
  }, 30000)
})

describe('render with icons', () => {
  test('preloadIcons loads icon data', async () => {
    const { preloadIcons } = await import('../../src/render/icon.ts')
    await preloadIcons([
      { name: 'mdi:home', size: 24 },
      { name: 'lucide:star', size: 24 }
    ])
    // Should not throw
  }, 30000)

  test('collectIcons finds icon primitives in element tree', async () => {
    const { collectIcons } = await import('../../src/render/index.ts')
    const React = await import('react')

    const element = React.createElement('frame', {}, [
      React.createElement('icon', { key: 1, icon: 'mdi:home' }),
      React.createElement('icon', { key: 2, icon: 'lucide:star' })
    ])

    const icons = collectIcons(element)
    expect(icons.map((i) => i.name)).toContain('mdi:home')
    expect(icons.map((i) => i.name)).toContain('lucide:star')
  })
})

describe('render with variables', () => {
  test('defineVars creates variable references', async () => {
    const { defineVars } = await import('../../src/render/vars.ts')

    const colors = defineVars({
      primary: { name: 'Colors/Blue', value: '#3B82F6' }
    })

    expect(colors.primary).toBeDefined()
    expect(colors.primary.name).toBe('Colors/Blue')
  })
})
