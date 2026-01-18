import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('set', () => {
  let rectId: string
  let textId: string

  beforeAll(async () => {
    await setupTestPage('set')
    const rect = await run('create rect --x 0 --y 0 --width 100 --height 100 --fill "#FFFFFF" --json') as any
    rectId = rect.id
    trackNode(rectId)

    const text = await run('create text --x 0 --y 150 --text "Test" --fontSize 16 --json') as any
    textId = text.id
    trackNode(textId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  describe('fill', () => {
    test('changes fill color', async () => {
      const result = await run(`set fill ${rectId} "#FF0000" --json`) as any
      expect(result.fills[0].color).toBe('#FF0000')
    })
  })

  describe('stroke', () => {
    test('changes stroke color and weight', async () => {
      const result = await run(`set stroke ${rectId} "#0000FF" --weight 2 --json`) as any
      expect(result.strokes[0].color).toBe('#0000FF')
      expect(result.strokeWeight).toBe(2)
    })
  })

  describe('radius', () => {
    test('changes corner radius', async () => {
      // Create rect with radius to test
      const rect = await run('create rect --x 200 --y 0 --width 50 --height 50 --radius 8 --json') as any
      trackNode(rect.id)
      expect(rect.cornerRadius).toBe(8)
    })
  })

  describe('opacity', () => {
    test('changes opacity', async () => {
      const result = await run(`set opacity ${rectId} 0.5 --json`) as any
      expect(result.opacity).toBe(0.5)
    })
  })

  describe('rotation', () => {
    test('changes rotation', async () => {
      await run(`set rotation ${rectId} 45 --json`)
      // Reset to 0 for other tests
      await run(`set rotation ${rectId} 0 --json`)
    })
  })

  describe('visible', () => {
    test('hides node', async () => {
      const result = await run(`set visible ${rectId} false --json`) as any
      expect(result.visible).toBe(false)
    })

    test('shows node', async () => {
      const result = await run(`set visible ${rectId} true --json`) as any
      // visible: true is default and not returned
      expect(result.visible).toBeUndefined()
    })
  })

  describe('locked', () => {
    test('locks node', async () => {
      const result = await run(`set locked ${rectId} true --json`) as any
      expect(result.locked).toBe(true)
    })

    test('unlocks node', async () => {
      const result = await run(`set locked ${rectId} false --json`) as any
      // locked: false is default and not returned
      expect(result.locked).toBeUndefined()
    })
  })

  describe('text', () => {
    test('changes text content', async () => {
      const result = await run(`set text ${textId} "New Text" --json`) as any
      expect(result.characters).toBe('New Text')
    })
  })

  describe('font-range', () => {
    test('changes font style for range', async () => {
      // Set text to known value first
      await run(`set text ${textId} "Hello World" --json`)
      const result = await run(`set font-range ${textId} --start 0 --end 5 --style Bold --json`) as any
      expect(result.characters).toBe('Hello World')
    })

    test('changes color for range', async () => {
      const result = await run(`set font-range ${textId} --start 6 --end 11 --color "#FF0000" --json`) as any
      expect(result.characters).toBe('Hello World')
    })

    test('changes font size for range', async () => {
      const result = await run(`set font-range ${textId} --start 0 --end 5 --size 24 --json`) as any
      expect(result.characters).toBe('Hello World')
    })
  })
})
