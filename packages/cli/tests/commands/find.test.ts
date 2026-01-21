import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('find', () => {
  beforeAll(async () => {
    await setupTestPage('find')
    const rect1 = (await run(
      'create rect --x 0 --y 0 --width 60 --height 60 --fill "#800080" --name "Searchable" --json'
    )) as any
    trackNode(rect1.id)
    const rect2 = (await run(
      'create rect --x 70 --y 0 --width 60 --height 60 --fill "#FFA500" --name "SearchableTwo" --json'
    )) as any
    trackNode(rect2.id)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('finds nodes by partial name', async () => {
    const results = (await run('find --name "Searchable" --json')) as any[]
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  test('filters by type', async () => {
    const results = (await run('find --name "Searchable" --type RECTANGLE --json')) as any[]
    expect(results.every((r) => r.type === 'RECTANGLE')).toBe(true)
  })

  test('finds by type only (without name)', async () => {
    const results = (await run('find --type RECTANGLE --json')) as any[]
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.type === 'RECTANGLE')).toBe(true)
  })

  test('respects limit', async () => {
    const results = (await run('find --type RECTANGLE --limit 5 --json')) as any[]
    expect(results.length).toBeLessThanOrEqual(5)
  })

  test('default limit is 100', async () => {
    const results = (await run('find --type FRAME --json')) as any[]
    expect(results.length).toBeLessThanOrEqual(100)
  })
})
