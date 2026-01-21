import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('import', () => {
  beforeAll(async () => {
    await setupTestPage('import')
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('imports SVG', async () => {
    const svg = '<svg width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
    const result = (await run(`import --svg '${svg}' --x 0 --y 0 --json`)) as any
    trackNode(result.id)
    expect(result.type).toBe('FRAME')
  })
})
