import { describe, test, expect, beforeAll } from 'bun:test'
import { run, trackNode } from '../helpers.ts'

describe('find', () => {
  beforeAll(async () => {
    const rect1 = await run('create rect --x 1200 --y 0 --width 60 --height 60 --fill "#800080" --name "Searchable" --json') as any
    trackNode(rect1.id)
    const rect2 = await run('create rect --x 1270 --y 0 --width 60 --height 60 --fill "#FFA500" --name "SearchableTwo" --json') as any
    trackNode(rect2.id)
  })

  test('finds nodes by partial name', async () => {
    const results = await run('find --name "Searchable" --json') as any[]
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  test('filters by type', async () => {
    const results = await run('find --name "Searchable" --type RECTANGLE --json') as any[]
    expect(results.every(r => r.type === 'RECTANGLE')).toBe(true)
  })

  test('finds by type only (without name)', async () => {
    const results = await run('find --type RECTANGLE --json') as any[]
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.type === 'RECTANGLE')).toBe(true)
  })
})
