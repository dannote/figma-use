import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

async function createVector(path: string, parent: string): Promise<string> {
  const group = (await run(
    `create vector --x 10 --y 10 --path "${path}" --fill "#FF0000" --parent ${parent} --json`
  )) as any
  trackNode(group.id)
  const children = (await run(`node children ${group.id} --json`)) as any[]
  return children[0]!.id
}

describe('path', () => {
  let testFrameId: string
  let vectorId: string

  beforeAll(async () => {
    await setupTestPage('path')
    const frame = (await run(
      'create frame --x 0 --y 0 --width 400 --height 300 --name "Path Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    vectorId = await createVector('M 0 0 L 100 0 L 100 100 L 0 100 Z', testFrameId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('get returns path data', async () => {
    const result = (await run(`path get ${vectorId} --json`)) as {
      paths: Array<{ windingRule: string; data: string }>
    }
    expect(result.paths).toBeArray()
    expect(result.paths.length).toBeGreaterThan(0)
    expect(result.paths[0]!.data).toContain('M')
    expect(result.paths[0]!.data).toContain('L')
  })

  test('set updates path data', async () => {
    const newPath = 'M 0 0 L 50 0 L 50 50 L 0 50 Z'
    await run(`path set ${vectorId} "${newPath}" --json`)

    const result = (await run(`path get ${vectorId} --json`)) as { paths: Array<{ data: string }> }
    expect(result.paths[0]!.data).toContain('50')
  })

  test('move translates path points', async () => {
    // Reset path
    await run(`path set ${vectorId} "M 0 0 L 100 0 L 100 100 L 0 100 Z" --json`)

    const result = (await run(`path move ${vectorId} --dx 10 --dy 20 --json`)) as {
      paths: Array<{ data: string }>
    }
    expect(result.paths[0]!.data).toContain('10')
    expect(result.paths[0]!.data).toContain('20')
  })

  test('scale changes path size', async () => {
    const vid = await createVector('M 0 0 L 100 0 L 100 100 L 0 100 Z', testFrameId)

    const result = (await run(`path scale ${vid} --factor 2 --json`)) as {
      paths: Array<{ data: string }>
    }
    expect(result.paths[0]!.data).toContain('200')
  })

  test('flip x mirrors horizontally', async () => {
    const vid = await createVector('M 0 0 L 100 50 L 0 100 Z', testFrameId)

    const result = (await run(`path flip ${vid} --axis x --json`)) as {
      paths: Array<{ data: string }>
    }
    expect(result.paths[0]!.data).toContain('-100')
  })

  test('flip y mirrors vertically', async () => {
    const vid = await createVector('M 0 0 L 100 50 L 0 100 Z', testFrameId)

    const result = (await run(`path flip ${vid} --axis y --json`)) as {
      paths: Array<{ data: string }>
    }
    expect(result.paths[0]!.data).toContain('-100')
  })
})

describe('node bounds', () => {
  let testFrameId: string
  let rectId: string

  beforeAll(async () => {
    await setupTestPage('bounds')
    const frame = (await run(
      'create frame --x 100 --y 200 --width 400 --height 300 --name "Bounds Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    const rect = (await run(
      `create rect --x 50 --y 50 --width 100 --height 80 --fill "#AAAAAA" --parent "${testFrameId}" --json`
    )) as any
    rectId = rect.id
    trackNode(rectId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('bounds returns position and size', async () => {
    const bounds = (await run(`node bounds ${rectId} --json`)) as any
    expect(bounds.x).toBe(50)
    expect(bounds.y).toBe(50)
    expect(bounds.width).toBe(100)
    expect(bounds.height).toBe(80)
  })

  test('bounds returns center point', async () => {
    const bounds = (await run(`node bounds ${rectId} --json`)) as any
    expect(bounds.centerX).toBe(100)
    expect(bounds.centerY).toBe(90)
  })

  test('bounds returns right and bottom edges', async () => {
    const bounds = (await run(`node bounds ${rectId} --json`)) as any
    expect(bounds.right).toBe(150)
    expect(bounds.bottom).toBe(130)
  })

  test('bounds works on frames', async () => {
    const bounds = (await run(`node bounds ${testFrameId} --json`)) as any
    expect(bounds.width).toBe(400)
    expect(bounds.height).toBe(300)
  })
})
