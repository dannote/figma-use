import { describe, test, expect } from 'bun:test'
import { run } from '../helpers.ts'

describe('profile', () => {
  test('shows error when DevTools not available', async () => {
    try {
      await run('profile "status" --port 19999', false)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.message).toContain('Cannot connect to DevTools')
    }
  })

  test('requires command argument', async () => {
    try {
      await run('profile', false)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.message).toContain('COMMAND')
    }
  })
})
