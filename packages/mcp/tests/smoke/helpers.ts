import { expect } from 'bun:test'

function getMcpUrl() {
  return process.env.FIGMA_MCP_URL || 'http://localhost:38451/mcp'
}

export type MCPResponse = {
  jsonrpc: '2.0'
  id: number
  result?: {
    content?: Array<{ type: string; text?: string }>
    isError?: boolean
  }
  error?: { code: number; message: string }
}

export async function mcpRequest(method: string, params?: unknown): Promise<MCPResponse> {
  const body = {
    jsonrpc: '2.0' as const,
    id: Date.now(),
    method,
    params: (params || {}) as Record<string, unknown>
  }

  const res = await fetch(getMcpUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const text = await res.text()
  return JSON.parse(text) as MCPResponse
}

export async function ensureMcpReady(): Promise<void> {
  const response = await mcpRequest('ping')
  if (response.error) {
    throw new Error(`MCP not ready: ${response.error.message}`)
  }
}

export async function toolExists(name: string): Promise<boolean> {
  const response = await mcpRequest('tools/list')
  if (response.error || !response.result) return false
  const result = response.result as { tools?: Array<{ name: string }> }
  return !!result.tools?.some((t) => t.name === name)
}

export function parseToolText(response: MCPResponse): unknown {
  expect(response.error).toBeUndefined()
  expect(response.result).toBeDefined()
  const result = response.result!
  expect(result.isError).toBe(false)
  const text = result.content?.find((c) => c.type === 'text')?.text || ''
  return JSON.parse(text)
}
