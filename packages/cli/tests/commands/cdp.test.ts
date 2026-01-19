import { describe, test, expect, afterAll } from 'bun:test'
import { run } from '../helpers.ts'

const createdCommentIds: string[] = []

describe('CDP commands', () => {
  afterAll(async () => {
    // Clean up created comments
    for (const id of createdCommentIds) {
      await run(`comment delete ${id}`).catch(() => {})
    }
  })

  describe('me', () => {
    test('returns current user', async () => {
      const result = (await run('me --json')) as {
        id: string
        handle?: string
        name?: string
        email?: string
      }
      expect(result.id).toBeDefined()
      expect(result.handle || result.name).toBeDefined()
    })
  })

  describe('file info', () => {
    test('returns file key and name', async () => {
      const result = (await run('file info --json')) as { key: string; name: string }
      expect(result.key).toMatch(/^[a-zA-Z0-9]+$/)
      expect(result.name).toBeDefined()
    })
  })

  describe('version list', () => {
    test('returns versions array', async () => {
      const result = (await run('version list --limit 5 --json')) as {
        id: string
        created_at: string
        user: { handle: string }
      }[]
      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        expect(result[0]!.id).toBeDefined()
        expect(result[0]!.created_at).toBeDefined()
        expect(result[0]!.user.handle).toBeDefined()
      }
    })
  })

  describe('comment', () => {
    test('list returns comments array', async () => {
      const result = (await run('comment list --json')) as { id: string; message: string }[]
      expect(Array.isArray(result)).toBe(true)
    })

    test('add creates a comment', async () => {
      const message = `Test comment ${Date.now()}`
      const result = (await run(`comment add "${message}" --json`)) as {
        id: string
        message: string
        file_key: string
        user: { id: string }
      }

      expect(result.id).toBeDefined()
      expect(result.message).toBe(message)
      expect(result.file_key).toBeDefined()
      expect(result.user.id).toBeDefined()

      createdCommentIds.push(result.id)
    })

    test('add with position creates comment at coordinates', async () => {
      const message = `Positioned comment ${Date.now()}`
      const result = (await run(`comment add "${message}" --x 200 --y 300 --json`)) as {
        id: string
        client_meta: { x: number; y: number }
      }

      expect(result.id).toBeDefined()
      expect(result.client_meta.x).toBe(200)
      expect(result.client_meta.y).toBe(300)

      createdCommentIds.push(result.id)
    })

    test('delete removes a comment', async () => {
      // Create a comment to delete
      const message = `Delete me ${Date.now()}`
      const created = (await run(`comment add "${message}" --json`)) as { id: string }

      // Delete it
      const deleteResult = (await run(`comment delete ${created.id}`, false)) as string
      expect(deleteResult).toContain('deleted')

      // Verify it's gone
      const list = (await run('comment list --json')) as { id: string }[]
      expect(list.find((c) => c.id === created.id)).toBeUndefined()
    })
  })
})

describe('font', () => {
  test('list returns fonts array', async () => {
    const result = (await run('font list --json')) as { family: string; style: string }[]
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.family).toBeDefined()
    expect(result[0]!.style).toBeDefined()
  })

  test('list filters by family', async () => {
    // Get first font family to use as filter
    const all = (await run('font list --json')) as { family: string }[]
    const firstFamily = all[0].family

    const result = (await run(`font list --family "${firstFamily}" --json`)) as { family: string }[]
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((f) => f.family.toLowerCase().includes(firstFamily.toLowerCase()))).toBe(
      true
    )
  })
})
