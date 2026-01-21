import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('node', () => {
  let testFrameId: string
  let nodeId: string

  beforeAll(async () => {
    await setupTestPage('node')
    const frame = (await run(
      'create frame --x 0 --y 0 --width 400 --height 300 --name "Node Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    const rect = (await run(
      `create rect --x 10 --y 10 --width 80 --height 80 --fill "#AAAAAA" --parent "${testFrameId}" --json`
    )) as any
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('get returns node info', async () => {
    const node = (await run(`node get ${nodeId} --json`)) as any
    expect(node.id).toBe(nodeId)
    expect(node.type).toBe('RECTANGLE')
  })

  test('children returns child nodes', async () => {
    const children = (await run(`node children ${testFrameId} --json`)) as any[]
    expect(Array.isArray(children)).toBe(true)
    expect(children.length).toBeGreaterThan(0)
  })

  test('move changes position', async () => {
    const moved = (await run(`node move ${nodeId} --x 50 --y 50 --json`)) as any
    expect(moved.x).toBe(50)
    expect(moved.y).toBe(50)
  })

  test('resize changes size', async () => {
    const resized = (await run(`node resize ${nodeId} --width 100 --height 100 --json`)) as any
    expect(resized.width).toBe(100)
    expect(resized.height).toBe(100)
  })

  test('rename changes name', async () => {
    const renamed = (await run(`node rename ${nodeId} "RenamedRect" --json`)) as any
    expect(renamed.name).toBe('RenamedRect')
  })

  test('clone duplicates node', async () => {
    const clone = (await run(`node clone ${nodeId} --json`)) as any
    trackNode(clone.id)
    expect(clone.type).toBe('RECTANGLE')
    expect(clone.id).not.toBe(nodeId)
  })

  test('delete removes node', async () => {
    const rect = (await run(
      `create rect --x 200 --y 10 --width 50 --height 50 --parent "${testFrameId}" --json`
    )) as any
    const result = (await run(`node delete ${rect.id} --json`)) as any
    expect(result.deleted).toBe(1)
  })

  test('tree returns formatted tree', async () => {
    const output = (await run(`node tree ${testFrameId}`, false)) as string
    expect(output).toContain('frame')
    expect(output).toContain(testFrameId)
    expect(output).toContain('nodes')
  })

  test('tree with depth limits output', async () => {
    const output = (await run(`node tree ${testFrameId} --depth 0`, false)) as string
    expect(output).toContain('frame')
  })

  test('tree depth affects node count', async () => {
    const frame = (await run(
      'create frame --x 0 --y 400 --width 200 --height 200 --name "TreeDepthTest" --json'
    )) as any
    trackNode(frame.id)
    await run(`create rect --x 10 --y 10 --width 50 --height 50 --parent "${frame.id}" --json`)
    await run(`create rect --x 70 --y 10 --width 50 --height 50 --parent "${frame.id}" --json`)

    const depth0 = (await run(`node tree ${frame.id} --depth 0`, false)) as string
    expect(depth0).toContain('1 nodes')

    const depth1 = (await run(`node tree ${frame.id} --depth 1`, false)) as string
    expect(depth1).toContain('3 nodes')
  })

  test('get shows component properties for instances', async () => {
    const comp = (await run(
      'create component --x 300 --y 400 --width 100 --height 50 --name "PropTestComp" --json'
    )) as any
    trackNode(comp.id)
    const instance = (await run(
      `create instance --component ${comp.id} --x 400 --y 400 --json`
    )) as any
    trackNode(instance.id)

    const node = (await run(`node get ${instance.id} --json`)) as any
    expect(node.type).toBe('INSTANCE')
  })

  test('to-component converts frame to component', async () => {
    const frame = (await run(
      'create frame --x 0 --y 500 --width 100 --height 50 --name "ToCompTest" --json'
    )) as any
    trackNode(frame.id)

    const result = (await run(`node to-component ${frame.id} --json`)) as any[]
    expect(result.length).toBe(1)
    expect(result[0]!.name).toBe('ToCompTest')
    trackNode(result[0]!.id)

    const comp = (await run(`node get ${result[0]!.id} --json`)) as any
    expect(comp.type).toBe('COMPONENT')
  })

  test('to-component converts multiple frames', async () => {
    const frame1 = (await run(
      'create frame --x 150 --y 500 --width 50 --height 50 --name "Multi1" --json'
    )) as any
    const frame2 = (await run(
      'create frame --x 210 --y 500 --width 50 --height 50 --name "Multi2" --json'
    )) as any
    trackNode(frame1.id)
    trackNode(frame2.id)

    const result = (await run(`node to-component "${frame1.id} ${frame2.id}" --json`)) as any[]
    expect(result.length).toBe(2)
    for (const comp of result) {
      trackNode(comp.id)
    }
  })
})
