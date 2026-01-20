/**
 * Render tests via CLI (CDP-based)
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

  test('renders component and returns correct node structure', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Test","items":["A"]}' --parent "${testFrameId}" --json`
    )) as Array<{ id: string; name: string }>

    expect(result.length).toBeGreaterThan(0)
    expect(result.find(n => n.name === 'Card')).toBeDefined()
    
    // Track for cleanup
    const card = result.find(n => n.name === 'Card')
    if (card) trackNode(card.id)
  }, 30000)

  test('renders correct number of nodes for multiple items', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Products","items":["iPhone","MacBook","AirPods"]}' --parent "${testFrameId}" --x 350 --json`
    )) as Array<{ id: string; name: string }>

    // Card + Title + Items frame + 3 item frames + 3 texts + Actions + 2 buttons + 2 button texts
    expect(result.length).toBeGreaterThanOrEqual(10)
    
    const card = result.find(n => n.name === 'Card')
    if (card) trackNode(card.id)
  }, 30000)

  test('applies layout and styling props', async () => {
    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Styled","items":["A"]}' --parent "${testFrameId}" --x 700 --json`
    )) as Array<{ id: string; name: string }>

    const card = result.find(n => n.name === 'Card')
    expect(card).toBeDefined()
    if (card) trackNode(card.id)

    // Verify via node get
    const cardInfo = (await run(`node get ${card!.id} --json`)) as {
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
    )) as Array<{ id: string; name: string }>

    const titleNode = result.find(n => n.name === 'Title')
    expect(titleNode).toBeDefined()
    
    const card = result.find(n => n.name === 'Card')
    if (card) trackNode(card.id)

    // Verify text content
    const titleInfo = (await run(`node get ${titleNode!.id} --json`)) as { characters?: string }
    expect(titleInfo.characters).toBe('Hello World')
  }, 30000)

  test('renders into specific parent', async () => {
    const container = (await run(
      `create frame --x 0 --y 400 --width 400 --height 300 --name "Container" --parent "${testFrameId}" --json`
    )) as { id: string }
    trackNode(container.id)

    const result = (await run(
      `render tests/fixtures/Card.figma.tsx --props '{"title":"Nested","items":["X"]}' --parent "${container.id}" --json`
    )) as Array<{ id: string; name: string }>

    const card = result.find(n => n.name === 'Card')
    expect(card).toBeDefined()

    // Verify parent
    const cardInfo = (await run(`node get ${card!.id} --json`)) as { parentId?: string }
    expect(cardInfo.parentId).toBe(container.id)
  }, 30000)
})

describe('render from file', () => {
  test('renders existing fixture file', async () => {
    const { run } = await import('../helpers.ts')
    
    // Use existing fixture
    const result = (await run(`render tests/fixtures/Card.figma.tsx --props '{"title":"FileTest","items":["A"]}' --json`)) as Array<{ id: string; name: string }>
    expect(result.length).toBeGreaterThan(0)
    expect(result.find(n => n.name === 'Card')).toBeDefined()
  }, 30000)
})

describe('render with icons', () => {
  test('preloadIcons loads icon data', async () => {
    const { preloadIcons } = await import('../../src/render/icon.ts')
    await preloadIcons([{ name: 'mdi:home', size: 24 }, { name: 'lucide:star', size: 24 }])
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
    // collectIcons returns array of {name, size} objects
    expect(icons.map(i => i.name)).toContain('mdi:home')
    expect(icons.map(i => i.name)).toContain('lucide:star')
  })
})

describe('render with variables', () => {
  test('defineVars creates variable references', async () => {
    const { defineVars } = await import('../../src/render/vars.ts')
    
    const colors = defineVars({
      primary: { name: 'Colors/Blue', value: '#3B82F6' }
    })
    
    // defineVars returns objects with Symbol marker
    expect(colors.primary).toBeDefined()
    expect(colors.primary.name).toBe('Colors/Blue')
  })
})
