import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

import type { NodeRef } from '../../src/types.ts'

describe('get', () => {
  let componentId: string
  let testPageId: string

  beforeAll(async () => {
    testPageId = await setupTestPage('get')
    const comp = (await run(
      'create component --x 0 --y 0 --width 100 --height 50 --name "TestGetComp" --json'
    )) as any
    componentId = comp.id
    trackNode(componentId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('pages returns array', async () => {
    const pages = (await run('get pages --json')) as NodeRef[]
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
  })

  test('components returns array', async () => {
    const components = (await run(
      `get components --page "${testPageId}" --limit 10 --json`
    )) as any[]
    expect(Array.isArray(components)).toBe(true)
  })

  test('components filters by name', async () => {
    const components = (await run(
      `get components --page "${testPageId}" --name "TestGetComp" --limit 10 --json`
    )) as any[]
    expect(components.length).toBeGreaterThanOrEqual(1)
    expect(components.some((c) => c.name === 'TestGetComp')).toBe(true)
  })

  test('components respects limit', async () => {
    const components = (await run(
      `get components --page "${testPageId}" --limit 5 --json`
    )) as any[]
    expect(components.length).toBeLessThanOrEqual(5)
  })

  test('styles returns styles object', async () => {
    const styles = (await run('get styles --json')) as any
    expect(typeof styles).toBe('object')
  })

  test('components filters by page ID', async () => {
    const components = (await run(
      `get components --page "${testPageId}" --limit 5 --json`
    )) as any[]
    expect(Array.isArray(components)).toBe(true)
    expect(components.some((c) => c.name === 'TestGetComp')).toBe(true)
  })
})
