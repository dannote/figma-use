import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { run, setupTestPage, teardownTestPage, trackNode } from '../helpers.ts'

describe('analyze colors', () => {
  beforeAll(async () => {
    await setupTestPage('analyze_colors')

    // Create frames with different colors
    const red = (await run('create rect --width 100 --height 100 --x 0 --y 0 --fill "#FF0000" --json')) as { id: string }
    trackNode(red.id)

    const blue = (await run('create rect --width 100 --height 100 --x 110 --y 0 --fill "#0000FF" --json')) as { id: string }
    trackNode(blue.id)

    // Same color multiple times
    for (let i = 0; i < 3; i++) {
      const green = (await run(`create rect --width 50 --height 50 --x ${i * 60} --y 110 --fill "#00FF00" --json`)) as { id: string }
      trackNode(green.id)
    }
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('returns color data', async () => {
    const result = (await run('analyze colors --json')) as {
      colors: Array<{ hex: string; count: number }>
      totalNodes: number
    }

    expect(result.colors).toBeInstanceOf(Array)
    expect(result.totalNodes).toBeGreaterThan(0)
  })

  test('colors have required fields', async () => {
    const result = (await run('analyze colors --json')) as {
      colors: Array<{
        hex: string
        count: number
        nodes: string[]
        isVariable: boolean
        isStyle: boolean
      }>
    }

    if (result.colors.length > 0) {
      const color = result.colors[0]
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i)
      expect(color.count).toBeNumber()
      expect(color.nodes).toBeInstanceOf(Array)
      expect(typeof color.isVariable).toBe('boolean')
      expect(typeof color.isStyle).toBe('boolean')
    }
  })

  test('human output includes hex and count', async () => {
    const output = (await run('analyze colors', false)) as string

    expect(output).toMatch(/#[0-9A-F]{6}/i)
    expect(output).toMatch(/\d+×/)
  })
})

describe('analyze typography', () => {
  beforeAll(async () => {
    await setupTestPage('analyze_typography')

    // Create text nodes
    for (let i = 0; i < 3; i++) {
      const text = (await run(
        `create text --text "Sample ${i}" --x ${i * 100} --y 0 --font-size 16 --json`
      )) as { id: string }
      trackNode(text.id)
    }

    const largeText = (await run(
      'create text --text "Large" --x 0 --y 50 --font-size 24 --json'
    )) as { id: string }
    trackNode(largeText.id)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('returns typography data', async () => {
    const result = (await run('analyze typography --json')) as {
      styles: Array<{ family: string; size: number }>
      totalTextNodes: number
    }

    expect(result.styles).toBeInstanceOf(Array)
    expect(result.totalTextNodes).toBeGreaterThan(0)
  })

  test('styles have required fields', async () => {
    const result = (await run('analyze typography --json')) as {
      styles: Array<{
        family: string
        size: number
        weight: string
        lineHeight: string
        count: number
        isStyle: boolean
      }>
    }

    if (result.styles.length > 0) {
      const style = result.styles[0]
      expect(style.family).toBeString()
      expect(style.size).toBeNumber()
      expect(style.weight).toBeString()
      expect(style.count).toBeNumber()
    }
  })

  test('group-by size works', async () => {
    const output = (await run('analyze typography --group-by size', false)) as string

    expect(output).toContain('px')
    expect(output).toMatch(/\d+×/)
  })
})

describe('analyze spacing', () => {
  beforeAll(async () => {
    await setupTestPage('analyze_spacing')

    // Create frames with auto-layout
    const frame1 = (await run(
      'create frame --width 200 --height 100 --x 0 --y 0 --layout HORIZONTAL --gap 16 --json'
    )) as { id: string }
    trackNode(frame1.id)

    const frame2 = (await run(
      'create frame --width 200 --height 100 --x 0 --y 120 --layout VERTICAL --gap 8 --json'
    )) as { id: string }
    trackNode(frame2.id)

    // Frame with padding
    const frame3 = (await run(
      'create frame --width 200 --height 100 --x 0 --y 240 --layout VERTICAL --padding 24 --json'
    )) as { id: string }
    trackNode(frame3.id)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('returns spacing data', async () => {
    const result = (await run('analyze spacing --json')) as {
      gaps: Array<{ value: number; count: number }>
      paddings: Array<{ value: number; count: number }>
      totalNodes: number
    }

    expect(result.gaps).toBeInstanceOf(Array)
    expect(result.paddings).toBeInstanceOf(Array)
    expect(result.totalNodes).toBeGreaterThan(0)
  })

  test('gaps have required fields', async () => {
    const result = (await run('analyze spacing --json')) as {
      gaps: Array<{
        value: number
        type: string
        count: number
        nodes: string[]
      }>
    }

    if (result.gaps.length > 0) {
      const gap = result.gaps[0]
      expect(gap.value).toBeNumber()
      expect(gap.type).toBe('gap')
      expect(gap.count).toBeNumber()
      expect(gap.nodes).toBeInstanceOf(Array)
    }
  })

  test('warns about off-grid values', async () => {
    // Create off-grid spacing
    const offGrid = (await run(
      'create frame --width 200 --height 100 --x 0 --y 360 --layout VERTICAL --gap 13 --json'
    )) as { id: string }
    trackNode(offGrid.id)

    const output = (await run('analyze spacing --grid 8', false)) as string

    expect(output).toContain('⚠')
  })
})
