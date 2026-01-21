import { describe, test, expect } from 'bun:test'

import { run } from '../helpers.ts'

describe('status', () => {
  test('returns connected status', async () => {
    const result = (await run('status --json')) as { connected: boolean; fileName: string }
    expect(result.connected).toBe(true)
    expect(typeof result.fileName).toBe('string')
  })
})
