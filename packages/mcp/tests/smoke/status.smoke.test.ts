import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, isSmokeEnabled, mcpRequest, parseToolText, toolExists } from './helpers'

describe('smoke/figma_status', () => {
  beforeAll(async () => {
    if (!isSmokeEnabled()) return
    await ensureMcpReady()
  })

  test('figma_status returns connected payload without tool error', async () => {
    if (!isSmokeEnabled()) return
    if (!(await toolExists('figma_status'))) return

    const response = await mcpRequest('tools/call', {
      name: 'figma_status',
      arguments: {}
    })

    const payload = parseToolText(response) as {
      connected?: boolean
      fileName?: string | null
      fileKey?: string | null
    }

    expect(typeof payload.connected).toBe('boolean')
    expect('fileName' in payload).toBe(true)
    expect('fileKey' in payload).toBe(true)
  })
})
