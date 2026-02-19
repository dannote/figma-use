import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, mcpRequest, parseToolText, toolExists } from './helpers'

describe('smoke/figma_variable_create', () => {
  beforeAll(async () => {
    await ensureMcpReady()
  })

  test('figma_variable_create creates a FLOAT variable in a new collection', async () => {
    if (!(await toolExists('figma_collection_create'))) return
    if (!(await toolExists('figma_variable_create'))) return

    const collectionResponse = await mcpRequest('tools/call', {
      name: 'figma_collection_create',
      arguments: { name: `smoke-vars-${Date.now()}` }
    })

    const collection = parseToolText(collectionResponse) as { id?: string }
    expect(typeof collection.id).toBe('string')
    expect(collection.id!.length).toBeGreaterThan(0)

    const createResponse = await mcpRequest('tools/call', {
      name: 'figma_variable_create',
      arguments: {
        name: `space-4-${Date.now()}`,
        collection: collection.id,
        type: 'FLOAT',
        value: '16'
      }
    })

    const variable = parseToolText(createResponse) as { id?: string; name?: string }
    expect(typeof variable.id).toBe('string')
    expect(variable.id!.length).toBeGreaterThan(0)
    expect(variable.name?.includes('space-4-')).toBe(true)
  })
})
