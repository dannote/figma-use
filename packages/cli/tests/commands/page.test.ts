import { describe, test, expect } from 'bun:test'

import { run } from '../helpers.ts'

describe('page', () => {
  test('current returns current page', async () => {
    const page = (await run('page current --json')) as { id: string; name: string }
    expect(page.id).toBeDefined()
    expect(page.name).toBeDefined()
    expect(page.id).toMatch(/^\d+:\d+$/)
  })

  test('list returns pages', async () => {
    const pages = (await run('page list --json')) as { id: string; name: string }[]
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
    const first = pages[0]!
    expect(first.id).toBeDefined()
    expect(first.name).toBeDefined()
  })

  test('set switches page by ID', async () => {
    const pages = (await run('page list --json')) as { id: string; name: string }[]
    const page = pages[0]!

    const result = (await run(`page set "${page.id}" --json`)) as { id: string; name: string }
    expect(result.id).toBe(page.id)
  })

  test('set switches page by partial name', async () => {
    const pages = (await run('page list --json')) as { id: string; name: string }[]
    const page = pages.find((p) => p.name.includes('Preview')) ?? pages[0]!
    const namePart = page.name.slice(0, 10).trim()

    const result = (await run(`page set "${namePart}" --json`)) as { id: string; name: string }
    expect(result.name).toContain(namePart)
  })
})
