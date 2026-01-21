import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('selection', () => {
  let nodeId: string

  beforeAll(async () => {
    await setupTestPage('selection')
    const rect = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --fill "#FF0000" --json'
    )) as any
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('set selects node', async () => {
    const result = (await run(`selection set "${nodeId}" --json`)) as any
    expect(result.selected).toBe(1)
  })

  test('get returns selection', async () => {
    await run(`selection set "${nodeId}" --json`)
    const result = (await run('selection get --json')) as any[]
    expect(result.some((n) => n.id === nodeId)).toBe(true)
  })
})
