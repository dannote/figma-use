import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('viewport', () => {
  let nodeId: string

  beforeAll(async () => {
    await setupTestPage('viewport')
    const rect = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --fill "#00FF00" --json'
    )) as any
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('get returns viewport info', async () => {
    const result = (await run('viewport get --json')) as any
    expect(result).toHaveProperty('center')
    expect(result).toHaveProperty('zoom')
  })

  test('zoom-to-fit zooms to nodes', async () => {
    const result = (await run(`viewport zoom-to-fit "${nodeId}" --json`)) as any
    expect(result).toHaveProperty('center')
    expect(result).toHaveProperty('zoom')
  })
})
