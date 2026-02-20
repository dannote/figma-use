import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, isSmokeEnabled, mcpRequest, parseToolText, toolExists } from './helpers'

describe('smoke/figma_page_current', () => {
  beforeAll(async () => {
    if (!isSmokeEnabled()) return
    await ensureMcpReady()
  })

  test('figma_page_current returns current page object', async () => {
    if (!isSmokeEnabled()) return
    if (!(await toolExists('figma_page_current'))) return

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
