import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { run, trackNode } from '../helpers.ts'

describe('node', () => {
  let testFrameId: string
  let nodeId: string

  beforeAll(async () => {
    const frame = await run('create frame --x 0 --y 700 --width 400 --height 300 --name "Node Tests" --json') as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    const rect = await run(`create rect --x 10 --y 10 --width 80 --height 80 --fill "#AAAAAA" --parent "${testFrameId}" --json`) as any
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    if (testFrameId) {
      await run(`node delete ${testFrameId} --json`).catch(() => {})
    }
  })

  test('get returns node info', async () => {
    const node = await run(`node get ${nodeId} --json`) as any
    expect(node.id).toBe(nodeId)
    expect(node.type).toBe('RECTANGLE')
  })

  test('children returns child nodes', async () => {
    const children = await run(`node children ${testFrameId} --json`) as any[]
    expect(Array.isArray(children)).toBe(true)
    expect(children.length).toBeGreaterThan(0)
  })

  test('move changes position', async () => {
    const moved = await run(`node move ${nodeId} --x 50 --y 50 --json`) as any
    expect(moved.x).toBe(50)
    expect(moved.y).toBe(50)
  })

  test('resize changes size', async () => {
    const resized = await run(`node resize ${nodeId} --width 100 --height 100 --json`) as any
    expect(resized.width).toBe(100)
    expect(resized.height).toBe(100)
  })

  test('rename changes name', async () => {
    const renamed = await run(`node rename ${nodeId} "RenamedRect" --json`) as any
    expect(renamed.name).toBe('RenamedRect')
  })

  test('clone duplicates node', async () => {
    const clone = await run(`node clone ${nodeId} --json`) as any
    trackNode(clone.id)
    expect(clone.type).toBe('RECTANGLE')
    expect(clone.id).not.toBe(nodeId)
  })

  test('delete removes node', async () => {
    const rect = await run(`create rect --x 200 --y 10 --width 50 --height 50 --parent "${testFrameId}" --json`) as any
    const result = await run(`node delete ${rect.id} --json`) as any
    expect(result.deleted).toBe(true)
  })

  test('tree returns formatted tree', async () => {
    const output = await run(`node tree ${testFrameId}`, false) as string
    expect(output).toContain('frame')
    expect(output).toContain(testFrameId)
    expect(output).toContain('nodes')
  })

  test('tree with depth limits output', async () => {
    const output = await run(`node tree ${testFrameId} --depth 0`, false) as string
    expect(output).toContain('frame')
    expect(output).not.toContain('[0] rectangle')
  })

  test('tree depth affects node count', async () => {
    const frame = await run('create frame --x 0 --y 800 --width 200 --height 200 --name "TreeDepthTest" --json') as any
    trackNode(frame.id)
    await run(`create rect --x 10 --y 10 --width 50 --height 50 --parent "${frame.id}" --json`)
    await run(`create rect --x 70 --y 10 --width 50 --height 50 --parent "${frame.id}" --json`)
    
    const depth0 = await run(`node tree ${frame.id} --depth 0`, false) as string
    expect(depth0).toContain('1 nodes')
    
    const depth1 = await run(`node tree ${frame.id} --depth 1`, false) as string
    expect(depth1).toContain('3 nodes')
  })
})
