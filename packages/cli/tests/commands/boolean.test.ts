import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('boolean', () => {
  let rect1Id: string
  let rect2Id: string

  beforeAll(async () => {
    await setupTestPage('boolean')
    const rect1 = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --fill "#FF0000" --json'
    )) as any
    rect1Id = rect1.id
    trackNode(rect1Id)

    const rect2 = (await run(
      'create rect --x 50 --y 50 --width 100 --height 100 --fill "#0000FF" --json'
    )) as any
    rect2Id = rect2.id
    trackNode(rect2Id)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('union combines shapes', async () => {
    const r1 = (await run('create rect --x 200 --y 0 --width 50 --height 50 --json')) as any
    const r2 = (await run('create rect --x 225 --y 25 --width 50 --height 50 --json')) as any
    const result = (await run(`boolean union "${r1.id},${r2.id}" --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('BOOLEAN_OPERATION')
  })

  test('subtract removes overlap', async () => {
    const r1 = (await run('create rect --x 300 --y 0 --width 50 --height 50 --json')) as any
    const r2 = (await run('create rect --x 325 --y 25 --width 50 --height 50 --json')) as any
    const result = (await run(`boolean subtract "${r1.id},${r2.id}" --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('BOOLEAN_OPERATION')
  })

  test('intersect keeps overlap', async () => {
    const r1 = (await run('create rect --x 400 --y 0 --width 50 --height 50 --json')) as any
    const r2 = (await run('create rect --x 425 --y 25 --width 50 --height 50 --json')) as any
    const result = (await run(`boolean intersect "${r1.id},${r2.id}" --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('BOOLEAN_OPERATION')
  })

  test('exclude removes overlap from both', async () => {
    const r1 = (await run('create rect --x 500 --y 0 --width 50 --height 50 --json')) as any
    const r2 = (await run('create rect --x 525 --y 25 --width 50 --height 50 --json')) as any
    const result = (await run(`boolean exclude "${r1.id},${r2.id}" --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('BOOLEAN_OPERATION')
  })
})
