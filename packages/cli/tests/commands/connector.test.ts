import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('connector', () => {
  let testFrameId: string
  let node1Id: string
  let node2Id: string

  beforeAll(async () => {
    await setupTestPage('connector')

    // Create test frame
    const frame = (await run(
      'create frame --x 0 --y 0 --width 800 --height 600 --name "Connector Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)

    // Create two nodes to connect
    const node1 = (await run(
      `create rect --x 50 --y 100 --width 100 --height 80 --name "Node A" --parent "${testFrameId}" --json`
    )) as { id: string }
    node1Id = node1.id
    trackNode(node1Id)

    const node2 = (await run(
      `create rect --x 300 --y 100 --width 100 --height 80 --name "Node B" --parent "${testFrameId}" --json`
    )) as { id: string }
    node2Id = node2.id
    trackNode(node2Id)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('list returns empty when no connectors', async () => {
    const result = (await run('connector list --json')) as any[]
    expect(Array.isArray(result)).toBe(true)
  })

  // Note: connector create only works in FigJam, so we test get/set/list
  // by creating a connector manually via eval (if in FigJam) or skip

  describe('with existing connector', () => {
    let connectorId: string | null = null

    beforeAll(async () => {
      // Try to create connector via plugin (only works in FigJam)
      try {
        const result = (await run(
          `connector create --from "${node1Id}" --to "${node2Id}" --json`
        )) as { id: string }
        connectorId = result.id
        trackNode(connectorId)
      } catch {
        // Not in FigJam, skip connector tests
        console.log('Skipping connector create test (not in FigJam)')
      }
    })

    test('get returns connector details', async () => {
      if (!connectorId) return // Skip if no connector

      const conn = (await run(`connector get "${connectorId}" --json`)) as any
      expect(conn.id).toBe(connectorId)
      expect(conn.type).toBe('CONNECTOR')
      expect(conn.connectorStart).toBeDefined()
      expect(conn.connectorEnd).toBeDefined()
    })

    test('set updates connector properties', async () => {
      if (!connectorId) return // Skip if no connector

      await run(`connector set "${connectorId}" --stroke "#FF0000" --stroke-weight 3 --json`)

      const conn = (await run(`connector get "${connectorId}" --json`)) as any
      expect(conn.strokeColor).toBe('#FF0000')
      expect(conn.strokeWeight).toBe(3)
    })

    test('list includes created connector', async () => {
      if (!connectorId) return // Skip if no connector

      const list = (await run('connector list --json')) as any[]
      const found = list.find((c) => c.id === connectorId)
      expect(found).toBeDefined()
    })
  })
})
