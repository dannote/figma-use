import { describe, test, expect, beforeAll } from 'bun:test'

import type { JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js'

const PROXY_URL = 'http://localhost:38451'

interface MCPResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

async function mcpRequest(method: string, params?: unknown): Promise<MCPResponse> {
  const request: JSONRPCRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: params as Record<string, unknown>
  }

  const response = await fetch(`${PROXY_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`)
  }
}

async function isProxyRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${PROXY_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    })
    return response.ok
  } catch {
    return false
  }
}

let skipTests = false

describe('MCP Integration', () => {
  beforeAll(async () => {
    skipTests = !(await isProxyRunning())
    if (skipTests) {
      console.log('⚠️  MCP server not running, skipping integration tests')
      console.log('   Start with: figma-use mcp serve --port 38451')
    }
  })

  test('initialize handshake', async () => {
    if (skipTests) return

    const response = await mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test', version: '1.0.0' },
      capabilities: {}
    })

    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()

    const result = response.result as {
      protocolVersion: string
      serverInfo: { name: string; version: string }
      capabilities: { tools: object }
    }

    expect(result.protocolVersion).toBe('2024-11-05')
    expect(result.serverInfo.name).toBe('figma-use')
    expect(result.capabilities.tools).toBeDefined()
  })

  test('tools/list returns all tools', async () => {
    if (skipTests) return

    const response = await mcpRequest('tools/list')

    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()

    const result = response.result as { tools: Array<{ name: string; description: string }> }

    expect(result.tools.length).toBeGreaterThan(50)
    expect(result.tools.some((t) => t.name === 'figma_status')).toBe(true)
    expect(result.tools.some((t) => t.name === 'figma_create_frame')).toBe(true)
  })

  test('tools/call executes command', async () => {
    if (skipTests) return

    const response = await mcpRequest('tools/call', {
      name: 'figma_status',
      arguments: {}
    })

    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()

    const result = response.result as { content: Array<{ type: string; text: string }> }
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.content[0]!.type).toBe('text')
    expect(result.content[0]!.text).toContain('figma')
  })

  test('tools/call with arguments', async () => {
    if (skipTests) return

    const response = await mcpRequest('tools/call', {
      name: 'figma_eval',
      arguments: { code: 'return 1 + 1' }
    })

    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()

    const result = response.result as { content: Array<{ type: string; text: string }> }
    const text = result.content.find((c) => c.type === 'text')?.text
    expect(text).toContain('2')
  })

  test('unknown tool returns error', async () => {
    if (skipTests) return

    const response = await mcpRequest('tools/call', {
      name: 'figma_nonexistent_command',
      arguments: {}
    })

    expect(response.error).toBeDefined()
    expect(response.error!.code).toBe(-32602)
    expect(response.error!.message).toContain('Unknown tool')
  })

  test('tools/call create and delete', async () => {
    if (skipTests) return

    const createResponse = await mcpRequest('tools/call', {
      name: 'figma_create_rectangle',
      arguments: { x: 0, y: 0, width: 50, height: 50, name: 'MCP Test Rect' }
    })

    expect(createResponse.error).toBeUndefined()
    expect(createResponse.result).toBeDefined()

    const createResult = createResponse.result as { content: Array<{ type: string; text: string }> }
    const createText = createResult.content.find((c) => c.type === 'text')?.text ?? ''

    const idMatch = createText.match(/id['":\s]+(\d+:\d+)/)
    expect(idMatch).not.toBeNull()

    const nodeId = idMatch![1]

    const deleteResponse = await mcpRequest('tools/call', {
      name: 'figma_node_delete',
      arguments: { id: nodeId }
    })

    expect(deleteResponse.error).toBeUndefined()
  })

  test('handles Figma connection errors gracefully', async () => {
    if (skipTests) return

    const response = await mcpRequest('tools/call', {
      name: 'figma_eval',
      arguments: { code: 'throw new Error("test error")' }
    })

    expect(response.error).toBeDefined()
    expect(response.error!.message).toContain('test error')
  })
})
