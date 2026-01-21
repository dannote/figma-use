import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('group', () => {
  beforeAll(async () => {
    await setupTestPage('group')
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('create groups nodes', async () => {
    const rect1 = (await run('create rect --x 0 --y 0 --width 50 --height 50 --json')) as any
    const rect2 = (await run('create rect --x 60 --y 0 --width 50 --height 50 --json')) as any

    const group = (await run(`group create "${rect1.id},${rect2.id}" --json`)) as any
    trackNode(group.id)
    expect(group.type).toBe('GROUP')
  })

  test('ungroup dissolves group', async () => {
    const rect1 = (await run('create rect --x 0 --y 100 --width 50 --height 50 --json')) as any
    const rect2 = (await run('create rect --x 60 --y 100 --width 50 --height 50 --json')) as any
    const group = (await run(`group create "${rect1.id},${rect2.id}" --json`)) as any

    const result = (await run(`group ungroup ${group.id} --json`)) as any[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    trackNode(result[0]!.id)
    trackNode(result[1].id)
  })

  test('flatten merges shapes', async () => {
    const rect1 = (await run('create rect --x 0 --y 200 --width 50 --height 50 --json')) as any
    const rect2 = (await run('create rect --x 25 --y 25 --width 50 --height 50 --json')) as any

    const result = (await run(`group flatten "${rect1.id},${rect2.id}" --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('VECTOR')
  })
})
