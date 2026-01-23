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

  test('ancestors returns parent chain', async () => {
    const outer = (await run(
      'create frame --x 0 --y 600 --width 300 --height 300 --name "Outer" --json'
    )) as any
    trackNode(outer.id)

    const inner = (await run(
      `create frame --x 10 --y 10 --width 100 --height 100 --name "Inner" --parent "${outer.id}" --json`
    )) as any
    trackNode(inner.id)

    const rect = (await run(
      `create rect --x 10 --y 10 --width 50 --height 50 --name "DeepRect" --parent "${inner.id}" --json`
    )) as any
    trackNode(rect.id)

    const ancestors = (await run(`node ancestors ${rect.id} --json`)) as any[]
    expect(ancestors.length).toBeGreaterThanOrEqual(3)
    expect(ancestors[0].id).toBe(rect.id)
    expect(ancestors[1].id).toBe(inner.id)
    expect(ancestors[2].id).toBe(outer.id)
  })

  test('ancestors respects depth limit', async () => {
    const ancestors = (await run(`node ancestors ${nodeId} --depth 1 --json`)) as any[]
    expect(ancestors.length).toBe(1)
  })

  test('bindings returns empty when no variables', async () => {
    const rect = (await run(
      `create rect --x 300 --y 600 --width 50 --height 50 --fill "#FF0000" --json`
    )) as any
    trackNode(rect.id)

    const bindings = (await run(`node bindings ${rect.id} --json`)) as any
    expect(bindings.id).toBe(rect.id)
    expect(bindings.fills).toBeUndefined()
    expect(bindings.strokes).toBeUndefined()
  })
})

test('replace-with creates instance from component', async () => {
  // Create a frame to replace
  const frame = (await run(
    'create frame --width 50 --height 50 --x 0 --y 900 --fill "#FF0000" --json'
  )) as any

  // Create a component to use as source
  const component = (await run(
    'create frame --width 30 --height 30 --x 100 --y 900 --fill "#00FF00" --json'
  )) as any
  const converted = (await run(`node to-component ${component.id} --json`)) as any[]
  const componentId = converted[0].id

  // Replace frame with component (should create instance)
  const replaced = (await run(
    `node replace-with ${frame.id} --target ${componentId} --json`
  )) as any

  expect(replaced.type).toBe('INSTANCE')
  expect(replaced.x).toBe(frame.x)
  expect(replaced.y).toBe(frame.y)

  // Cleanup
  await run(`node delete ${replaced.id}`)
  await run(`node delete ${componentId}`)
})

test('replace-with clones regular node', async () => {
  // Create two frames
  const frame1 = (await run(
    'create frame --width 50 --height 50 --x 0 --y 900 --fill "#FF0000" --json'
  )) as any

  const frame2 = (await run(
    'create frame --width 80 --height 40 --x 200 --y 900 --fill "#00FF00" --json'
  )) as any

  // Replace frame1 with frame2 (should clone)
  const replaced = (await run(`node replace-with ${frame1.id} --target ${frame2.id} --json`)) as any

  expect(replaced.type).toBe('FRAME')
  expect(replaced.x).toBe(frame1.x)
  expect(replaced.y).toBe(frame1.y)

  // Cleanup
  await run(`node delete ${replaced.id}`)
  await run(`node delete ${frame2.id}`)
})
