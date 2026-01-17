import { describe, test, expect, beforeAll } from 'bun:test'
import { run, trackNode } from '../helpers.ts'

describe('get', () => {
  let componentId: string

  beforeAll(async () => {
    const comp = await run('create component --x 1400 --y 0 --width 100 --height 50 --name "TestGetComp" --json') as any
    componentId = comp.id
    trackNode(componentId)
  })

  test('pages returns array', async () => {
    const pages = await run('get pages --json') as { id: string; name: string }[]
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
  })

  test('components returns array', async () => {
    const components = await run('get components --limit 10 --json') as any[]
    expect(Array.isArray(components)).toBe(true)
  })

  test('components filters by name', async () => {
    const components = await run('get components --name "TestGetComp" --limit 10 --json') as any[]
    expect(components.length).toBeGreaterThanOrEqual(1)
    expect(components.some(c => c.name === 'TestGetComp')).toBe(true)
  })

  test('components respects limit', async () => {
    const components = await run('get components --limit 5 --json') as any[]
    expect(components.length).toBeLessThanOrEqual(5)
  })

  test('styles returns styles object', async () => {
    const styles = await run('get styles --json') as any
    expect(typeof styles).toBe('object')
  })
})
