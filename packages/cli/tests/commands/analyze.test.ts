import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from 'bun:test'

import { run, setupTestPage, teardownTestPage, trackNode } from '../helpers.ts'

setDefaultTimeout(30000)

describe('analyze clusters', () => {
  beforeAll(async () => {
    await setupTestPage('analyze_clusters')

    // Create similar frames to form clusters
    for (let i = 0; i < 5; i++) {
      const frame = (await run(
        `create frame --name "Card ${i}" --width 200 --height 100 --x ${i * 220} --y 0 --json`
      )) as { id: string }
      trackNode(frame.id)

      // Add text child to each
      const text = (await run(
        `create text --text "Item ${i}" --x 10 --y 10 --parent ${frame.id} --json`
      )) as { id: string }
      trackNode(text.id)
    }

    // Create different cluster - icons
    for (let i = 0; i < 3; i++) {
      const icon = (await run(
        `create frame --name "Icon ${i}" --width 32 --height 32 --x ${i * 50} --y 150 --json`
      )) as { id: string }
      trackNode(icon.id)
    }
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('finds repeated patterns', async () => {
    const result = (await run('analyze clusters --json')) as {
      clusters: Array<{
        signature: string
        nodes: Array<{ id: string; name: string }>
      }>
      totalNodes: number
    }

    expect(result.clusters).toBeInstanceOf(Array)
    expect(result.totalNodes).toBeGreaterThan(0)
  })

  test('clusters have required fields', async () => {
    const result = (await run('analyze clusters --json')) as {
      clusters: Array<{
        signature: string
        nodes: Array<{ id: string; name: string; width: number; height: number }>
        avgWidth: number
        avgHeight: number
        widthRange: number
        heightRange: number
      }>
    }

    if (result.clusters.length > 0) {
      const cluster = result.clusters[0]
      expect(cluster.signature).toBeString()
      expect(cluster.nodes).toBeInstanceOf(Array)
      expect(cluster.avgWidth).toBeNumber()
      expect(cluster.avgHeight).toBeNumber()
      expect(typeof cluster.widthRange).toBe('number')
      expect(typeof cluster.heightRange).toBe('number')
    }
  })

  test('respects min-count filter', async () => {
    const result = (await run('analyze clusters --min-count 3 --json')) as {
      clusters: Array<{ nodes: Array<unknown> }>
    }

    for (const cluster of result.clusters) {
      expect(cluster.nodes.length).toBeGreaterThanOrEqual(3)
    }
  })

  test('respects limit', async () => {
    const result = (await run('analyze clusters --limit 2 --json')) as {
      clusters: Array<unknown>
    }

    expect(result.clusters.length).toBeLessThanOrEqual(2)
  })

  test('respects min-size filter', async () => {
    const result = (await run('analyze clusters --min-size 50 --json')) as {
      clusters: Array<{ nodes: Array<{ width: number; height: number }> }>
    }

    for (const cluster of result.clusters) {
      for (const node of cluster.nodes) {
        expect(node.width).toBeGreaterThanOrEqual(50)
        expect(node.height).toBeGreaterThanOrEqual(50)
      }
    }
  })

  test('groups similar sized frames together', async () => {
    const result = (await run('analyze clusters --json')) as {
      clusters: Array<{
        nodes: Array<{ name: string; width: number; height: number }>
        avgWidth: number
        avgHeight: number
      }>
    }

    const cardCluster = result.clusters.find(
      (c) => c.avgWidth >= 180 && c.avgWidth <= 220 && c.avgHeight >= 80 && c.avgHeight <= 120
    )

    if (cardCluster) {
      for (const node of cardCluster.nodes) {
        expect(Math.abs(node.width - cardCluster.avgWidth)).toBeLessThan(50)
        expect(Math.abs(node.height - cardCluster.avgHeight)).toBeLessThan(50)
      }
    }
  })

  test('human-readable output includes key info', async () => {
    const output = (await run('analyze clusters --limit 3', false)) as string

    expect(output).toMatch(/\d+×/)
    expect(output).toMatch(/frame|component/i)
    expect(output).toMatch(/\d+% match/)
    expect(output).toContain('examples:')
  })
})

describe('analyze colors', () => {
  beforeAll(async () => {
    await setupTestPage('analyze_colors')

    const red = (await run(
      'create rect --width 100 --height 100 --x 0 --y 0 --fill "#FF0000" --json'
    )) as { id: string }
    trackNode(red.id)

    const blue = (await run(
      'create rect --width 100 --height 100 --x 110 --y 0 --fill "#0000FF" --json'
    )) as { id: string }
    trackNode(blue.id)

    for (let i = 0; i < 3; i++) {
      const green = (await run(
        `create rect --width 50 --height 50 --x ${i * 60} --y 110 --fill "#00FF00" --json`
      )) as { id: string }
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

    const frame1 = (await run(
      'create frame --width 200 --height 100 --x 0 --y 0 --layout HORIZONTAL --gap 16 --json'
    )) as { id: string }
    trackNode(frame1.id)

    const frame2 = (await run(
      'create frame --width 200 --height 100 --x 0 --y 120 --layout VERTICAL --gap 8 --json'
    )) as { id: string }
    trackNode(frame2.id)

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
    const offGrid = (await run(
      'create frame --width 200 --height 100 --x 0 --y 360 --layout VERTICAL --gap 13 --json'
    )) as { id: string }
    trackNode(offGrid.id)

    const output = (await run('analyze spacing --grid 8', false)) as string

    expect(output).toContain('⚠')
  })
})
