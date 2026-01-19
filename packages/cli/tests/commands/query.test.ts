import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('query', () => {
  let testFrameId: string
  let buttonId: string
  let textId: string
  let nestedFrameId: string

  beforeAll(async () => {
    await setupTestPage('query')

    // Create test structure
    const frame = (await run(
      'create frame --x 0 --y 0 --width 800 --height 600 --name "QueryTests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    // Create a button-like frame
    const button = (await run(
      `create frame --x 10 --y 10 --width 120 --height 40 --name "PrimaryButton" --radius 8 --fill "#3B82F6" --parent "${testFrameId}" --json`
    )) as { id: string }
    buttonId = button.id
    trackNode(buttonId)

    // Create text inside button
    const text = (await run(
      `create text --x 20 --y 20 --text "Click me" --parent "${buttonId}" --json`
    )) as { id: string }
    textId = text.id
    trackNode(textId)

    // Create nested frame
    const nested = (await run(
      `create frame --x 10 --y 60 --width 200 --height 100 --name "Container" --parent "${testFrameId}" --json`
    )) as { id: string }
    nestedFrameId = nested.id
    trackNode(nestedFrameId)

    // Create small frame inside nested
    await run(
      `create frame --x 0 --y 0 --width 50 --height 50 --name "SmallBox" --radius 4 --parent "${nestedFrameId}" --json`
    )
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  describe('type selectors', () => {
    test('finds all FRAME nodes', async () => {
      const result = (await run(`query "//FRAME" --root "${testFrameId}" --json`)) as any[]
      expect(result.length).toBeGreaterThanOrEqual(3)
      expect(result.every(n => n.type === 'FRAME')).toBe(true)
    })

    test('finds TEXT nodes', async () => {
      const result = (await run(`query "//TEXT" --root "${testFrameId}" --json`)) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].type).toBe('TEXT')
    })
  })

  describe('attribute selectors', () => {
    test('finds by exact name', async () => {
      const result = (await run(
        `query "//FRAME[@name = 'PrimaryButton']" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('PrimaryButton')
    })

    test('finds by width comparison', async () => {
      const result = (await run(
        `query "//FRAME[@width < 100]" --root "${testFrameId}" --select "id,name,type,width" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.every(n => n.width < 100)).toBe(true)
    })

    test('finds by cornerRadius > 0', async () => {
      const result = (await run(
        `query "//FRAME[@cornerRadius > 0]" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    test('combines multiple conditions with and', async () => {
      const result = (await run(
        `query "//FRAME[@cornerRadius > 0 and @width < 100]" --root "${testFrameId}" --select "id,name,type,width,cornerRadius" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.every(n => n.cornerRadius > 0 && n.width < 100)).toBe(true)
    })
  })

  describe('string functions', () => {
    test('contains() matches substring', async () => {
      const result = (await run(
        `query "//FRAME[contains(@name, 'Button')]" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].name).toContain('Button')
    })

    test('starts-with() matches prefix', async () => {
      const result = (await run(
        `query "//FRAME[starts-with(@name, 'Primary')]" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].name.startsWith('Primary')).toBe(true)
    })
  })

  describe('axes', () => {
    test('child axis (/) finds direct children', async () => {
      const result = (await run(
        `query "//FRAME[@name = 'QueryTests']/FRAME" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBe(2) // PrimaryButton and Container
    })

    test('descendant axis (//) finds nested nodes', async () => {
      const result = (await run(
        `query "//FRAME[@name = 'QueryTests']//FRAME" --root "${testFrameId}" --json`
      )) as any[]
      expect(result.length).toBeGreaterThanOrEqual(3) // All nested frames
    })
  })

  describe('select option', () => {
    test('returns only specified fields', async () => {
      const result = (await run(
        `query "//FRAME" --root "${testFrameId}" --select "id,name,width" --json`
      )) as any[]
      expect(result.length).toBeGreaterThan(0)
      const keys = Object.keys(result[0])
      expect(keys).toContain('id')
      expect(keys).toContain('name')
      expect(keys).toContain('width')
      expect(keys).not.toContain('height')
    })
  })

  describe('limit option', () => {
    test('limits number of results', async () => {
      const result = (await run(
        `query "//FRAME" --root "${testFrameId}" --limit 2 --json`
      )) as any[]
      expect(result.length).toBe(2)
    })
  })
})
