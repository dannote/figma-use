import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const MCP_URL = process.env.FIGMA_MCP_URL || 'http://localhost:38452/mcp'

interface MCPResult {
  content?: Array<{ type: string; text: string }>
  isError?: boolean
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: number
  result?: MCPResult
  error?: { code: number; message: string }
}

let skipTests = false

async function mcpCall(
  tool: string,
  args: Record<string, unknown> = {}
): Promise<{ data: unknown; isError: boolean }> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    })
  })
  const response = (await res.json()) as MCPResponse
  if (response.error) throw new Error(response.error.message)
  const result = response.result as MCPResult
  const text = result?.content?.[0]?.text || '{}'
  return { data: JSON.parse(text), isError: result?.isError || false }
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    })
    return res.ok
  } catch {
    return false
  }
}

describe('MCP arg mapping', () => {
  const createdNodes: string[] = []
  let collectionId: string
  let variableId: string

  beforeAll(async () => {
    skipTests = !(await isServerRunning())
    if (skipTests) {
      console.log('⚠️  MCP server not running, skipping MCP arg tests')
      console.log('   Start with: figma-use mcp serve --port 38451')
    }
  })

  afterAll(async () => {
    if (skipTests) return
    for (const id of createdNodes) {
      try {
        await mcpCall('figma_node_delete', { ids: id })
      } catch {}
    }
    if (variableId) {
      try {
        await mcpCall('figma_variable_delete', { id: variableId })
      } catch {}
    }
    if (collectionId) {
      try {
        await mcpCall('figma_collection_delete', { id: collectionId })
      } catch {}
    }
  })

  test('figma_status returns connected payload', async () => {
    if (skipTests) return
    const { data, isError } = await mcpCall('figma_status')
    expect(isError).toBe(false)
    const status = data as { connected: boolean; fileName: string | null; fileKey: string | null }
    expect(status.connected).toBe(true)
    expect(typeof status.fileName).toBe('string')
    expect(typeof status.fileKey).toBe('string')
  })

  test('figma_page_current returns page info', async () => {
    if (skipTests) return
    const { data, isError } = await mcpCall('figma_page_current')
    expect(isError).toBe(false)
    const page = data as { id: string; name: string }
    expect(page.id).toBeDefined()
    expect(page.name).toBeDefined()
  })

  test('figma_variable_create with collection arg', async () => {
    if (skipTests) return
    const coll = await mcpCall('figma_collection_create', { name: `mcp-test-${Date.now()}` })
    expect(coll.isError).toBe(false)
    collectionId = (coll.data as { id: string }).id

    const { data, isError } = await mcpCall('figma_variable_create', {
      name: 'mcp-space-4',
      collection: collectionId,
      type: 'FLOAT',
      value: '16'
    })
    expect(isError).toBe(false)
    variableId = (data as { id: string }).id
    expect(variableId).toBeDefined()
  })

  test('figma_set_visible with value arg', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id
    createdNodes.push(id)

    const { data, isError } = await mcpCall('figma_set_visible', { id, value: 'false' })
    expect(isError).toBe(false)
    expect((data as { visible: boolean }).visible).toBe(false)

    const restore = await mcpCall('figma_set_visible', { id, value: 'true' })
    expect(restore.isError).toBe(false)
    expect((restore.data as { visible: boolean | null }).visible).not.toBe(false)
  })

  test('figma_set_locked with value arg', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id
    createdNodes.push(id)

    const { data, isError } = await mcpCall('figma_set_locked', { id, value: 'true' })
    expect(isError).toBe(false)
    expect((data as { locked: boolean }).locked).toBe(true)
  })

  test('figma_set_opacity with value arg', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id
    createdNodes.push(id)

    const { data, isError } = await mcpCall('figma_set_opacity', { id, value: '0.5' })
    expect(isError).toBe(false)
    const opacity = (data as { opacity: number }).opacity
    expect(Math.abs(opacity - 0.5)).toBeLessThan(0.01)
  })

  test('figma_selection_set with string ids', async () => {
    if (skipTests) return
    const r1 = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const r2 = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 20, y: 0 })
    const id1 = (r1.data as { id: string }).id
    const id2 = (r2.data as { id: string }).id
    createdNodes.push(id1, id2)

    const { data, isError } = await mcpCall('figma_selection_set', { ids: `${id1},${id2}` })
    expect(isError).toBe(false)
    expect((data as { selected: number }).selected).toBe(2)
  })

  test('figma_viewport_zoom-to-fit with string ids', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 100, height: 100, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id
    createdNodes.push(id)

    const { isError } = await mcpCall('figma_viewport_zoom-to-fit', { ids: id })
    expect(isError).toBe(false)
  })

  test('figma_group_create with string ids', async () => {
    if (skipTests) return
    const r1 = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const r2 = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 20, y: 0 })
    const id1 = (r1.data as { id: string }).id
    const id2 = (r2.data as { id: string }).id

    const { data, isError } = await mcpCall('figma_group_create', { ids: `${id1},${id2}` })
    expect(isError).toBe(false)
    const groupId = (data as { id: string }).id
    createdNodes.push(groupId)
  })

  test('figma_node_delete with string ids', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 10, height: 10, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id

    const { data, isError } = await mcpCall('figma_node_delete', { ids: id })
    expect(isError).toBe(false)
    expect((data as { deleted: number }).deleted).toBe(1)
  })

  test('figma_node_to-component converts frame', async () => {
    if (skipTests) return
    const frame = await mcpCall('figma_create_frame', { width: 50, height: 50, x: 0, y: 0 })
    const id = (frame.data as { id: string }).id

    const { data, isError } = await mcpCall('figma_node_to-component', { ids: id })
    expect(isError).toBe(false)
    const components = data as Array<{ id: string; name: string }>
    expect(components.length).toBe(1)
    createdNodes.push(components[0].id)
  })

  test('figma_set_radius with kebab-case args', async () => {
    if (skipTests) return
    const rect = await mcpCall('figma_create_rect', { width: 50, height: 50, x: 0, y: 0 })
    const id = (rect.data as { id: string }).id
    createdNodes.push(id)

    const { data, isError } = await mcpCall('figma_set_radius', {
      id,
      'top-left': '8',
      'bottom-right': '16'
    })
    expect(isError).toBe(false)
    const node = data as { topLeftRadius: number; bottomRightRadius: number }
    expect(node.topLeftRadius).toBe(8)
    expect(node.bottomRightRadius).toBe(16)
  })

  test('figma_set_layout with CLI arg names', async () => {
    if (skipTests) return
    const frame = await mcpCall('figma_create_frame', { width: 200, height: 200, x: 0, y: 0 })
    const id = (frame.data as { id: string }).id
    createdNodes.push(id)

    const { data, isError } = await mcpCall('figma_set_layout', {
      id,
      mode: 'vertical',
      gap: '12',
      padding: '16'
    })
    expect(isError).toBe(false)
    const node = data as { layoutMode: string; itemSpacing: number; padding: { top: number } }
    expect(node.layoutMode).toBe('VERTICAL')
    expect(node.itemSpacing).toBe(12)
    expect(node.padding.top).toBe(16)
  })

  test('figma_boolean_union with string ids', async () => {
    if (skipTests) return
    const r1 = await mcpCall('figma_create_rect', { width: 50, height: 50, x: 0, y: 0 })
    const r2 = await mcpCall('figma_create_rect', { width: 50, height: 50, x: 25, y: 25 })
    const id1 = (r1.data as { id: string }).id
    const id2 = (r2.data as { id: string }).id

    const { data, isError } = await mcpCall('figma_boolean_union', { ids: `${id1},${id2}` })
    expect(isError).toBe(false)
    createdNodes.push((data as { id: string }).id)
  })
})
