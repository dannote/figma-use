import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import type { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js'
import { getTools } from '../src/index.ts'

const PROXY_URL = 'http://localhost:38451'

async function mcpRequest(method: string, params?: unknown): Promise<JSONRPCResponse> {
  const request: JSONRPCRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
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
    // Check proxy status
    const statusRes = await fetch(`${PROXY_URL}/status`)
    const status = await statusRes.json() as { pluginConnected: boolean }
    if (!status.pluginConnected) return false
    
    // Check MCP endpoint responds
    const mcpRes = await fetch(`${PROXY_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
    })
    const response = await mcpRes.json() as JSONRPCResponse
    return response.jsonrpc === '2.0'
  } catch {
    return false
  }
}

describe('MCP Integration', () => {
  let skipTests = false
  
  beforeAll(async () => {
    skipTests = !(await isProxyRunning())
    if (skipTests) {
      console.warn('⚠ Skipping MCP integration tests: proxy not running or plugin not connected')
    }
  })
  
  test('initialize returns server info', async () => {
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
    expect(result.tools.some(t => t.name === 'figma_status')).toBe(true)
    expect(result.tools.some(t => t.name === 'figma_create_frame')).toBe(true)
  })
  
  test('tools/call figma_status returns connection status', async () => {
    if (skipTests) return
    
    const response = await mcpRequest('tools/call', {
      name: 'figma_status',
      arguments: {}
    })
    
    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()
    
    const result = response.result as { content: Array<{ type: string; text: string }>; isError: boolean }
    
    expect(result.isError).toBe(false)
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('pluginConnected')
  })
  
  test('tools/call figma_page_list returns pages', async () => {
    if (skipTests) return
    
    const response = await mcpRequest('tools/call', {
      name: 'figma_page_list',
      arguments: {}
    })
    
    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()
    
    const result = response.result as { content: Array<{ type: string; text: string }>; isError: boolean }
    
    expect(result.isError).toBe(false)
    
    const pages = JSON.parse(result.content[0].text)
    expect(Array.isArray(pages)).toBe(true)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0]).toHaveProperty('id')
    expect(pages[0]).toHaveProperty('name')
  })
  
  test('tools/call with unknown tool returns error', async () => {
    if (skipTests) return
    
    const response = await mcpRequest('tools/call', {
      name: 'figma_nonexistent_tool',
      arguments: {}
    })
    
    expect(response.error).toBeDefined()
    expect(response.error?.code).toBe(-32602)
    expect(response.error?.message).toContain('Unknown tool')
  })
  
  test('tools/call figma_create_rect creates a rectangle', async () => {
    if (skipTests) return
    
    // String args are coerced to numbers by the proxy (matching CLI behavior)
    const response = await mcpRequest('tools/call', {
      name: 'figma_create_rect',
      arguments: {
        x: '0',
        y: '0',
        width: '100',
        height: '100',
        fill: '#FF0000'
      }
    })
    
    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()
    
    const result = response.result as { content: Array<{ type: string; text: string }>; isError: boolean }
    
    expect(result.isError).toBe(false)
    
    const node = JSON.parse(result.content[0].text)
    expect(node).toHaveProperty('id')
    expect(node.type).toBe('RECTANGLE')
    
    // Clean up
    if (node.id) {
      await mcpRequest('tools/call', {
        name: 'figma_node_delete',
        arguments: { id: node.id }
      })
    }
  })
  
  test('ping returns empty result', async () => {
    if (skipTests) return
    
    const response = await mcpRequest('ping')
    
    expect(response.error).toBeUndefined()
    expect(response.result).toBeDefined()
  })
  
  test('unknown method returns error', async () => {
    if (skipTests) return
    
    const response = await mcpRequest('unknown/method')
    
    expect(response.error).toBeDefined()
    expect(response.error?.code).toBe(-32601)
  })
})
