import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, mcpRequest, parseToolText } from './helpers'

describe('smoke/figma_page_current', () => {
  beforeAll(async () => {
    await ensureMcpReady()
  })

  test('figma_page_current returns current page object', async () => {
    const response = await mcpRequest('tools/call', {
      name: 'figma_page_current',
      arguments: {}
    })

    const payload = parseToolText(response) as { id?: string; name?: string }
    expect(typeof payload.id).toBe('string')
    expect(payload.id!.length).toBeGreaterThan(0)
    expect(typeof payload.name).toBe('string')
    expect(payload.name!.length).toBeGreaterThan(0)
  })
})
