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

  test('applies advanced styling props (corners, effects, constraints)', async () => {
    const jsx = `<Frame w={200} h={100} roundedTL={20} roundedTR={10} roundedBL={5} roundedBR={0} cornerSmoothing={0.6} overflow="hidden" shadow="0px 4px 8px rgba(0,0,0,0.25)" minW={100} maxW={400} />`
    const result = (await run(
      `render --stdin --parent "${testFrameId}" --x 500 --y 400 --json`,
      jsx
    )) as { id: string }
    trackNode(result.id)

    const nodeInfo = (await run(`node get ${result.id} --json`)) as {
      topLeftRadius?: number
      topRightRadius?: number
      bottomLeftRadius?: number
      bottomRightRadius?: number
      cornerSmoothing?: number
      clipsContent?: boolean
      effects?: Array<{ type: string; radius?: number }>
      minWidth?: number
      maxWidth?: number
    }

    expect(nodeInfo.topLeftRadius).toBe(20)
    expect(nodeInfo.topRightRadius).toBe(10)
    expect(nodeInfo.bottomLeftRadius).toBe(5)
    expect(nodeInfo.bottomRightRadius).toBe(0)
    expect(nodeInfo.cornerSmoothing).toBeCloseTo(0.6, 1)
    expect(nodeInfo.clipsContent).toBe(true)
    expect(nodeInfo.effects?.length).toBe(1)
    expect(nodeInfo.effects?.[0].type).toBe('DROP_SHADOW')
    expect(nodeInfo.minWidth).toBe(100)
    expect(nodeInfo.maxWidth).toBe(400)
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

describe('render with instances', () => {
  test('renders component instance via <Instance>', async () => {
    const { run, trackNode, setupTestPage, teardownTestPage } = await import('../helpers.ts')
    const fs = await import('fs')
    const path = await import('path')

    await setupTestPage('render-instance')

    // Create a component first
    const comp = (await run(
      'create component --x 2000 --y 0 --width 100 --height 50 --name "TestInstanceComp" --json'
    )) as { id: string }
    trackNode(comp.id)

    // Create temp fixture file with instance
    const fixtureDir = path.join(import.meta.dir, '../fixtures')
    const fixturePath = path.join(fixtureDir, 'InstanceTest.figma.tsx')
    const jsx = `export default ({ componentId }: { componentId: string }) => (
  <frame w={200} h={100} flex="row" gap={10} name="InstanceTest">
    <instance component={componentId} />
  </frame>
)`
    fs.writeFileSync(fixturePath, jsx)

    try {
      const result = (await run(
        `render tests/fixtures/InstanceTest.figma.tsx --props '{"componentId":"${comp.id}"}' --json`
      )) as { id: string; name: string }

      expect(result.id).toBeDefined()
      expect(result.name).toBe('InstanceTest')
      trackNode(result.id)

      // Verify instance was created inside
      const tree = (await run(`node tree ${result.id} --depth 2 --json`)) as {
        children?: Array<{ type: string }>
      }
      expect(tree.children?.some((c) => c.type === 'INSTANCE')).toBe(true)
    } finally {
      fs.unlinkSync(fixturePath)
      await teardownTestPage()
    }
  }, 30000)
})
