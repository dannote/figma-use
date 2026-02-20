import { beforeAll, describe, expect, test } from 'bun:test'

import { ensureMcpReady, isSmokeEnabled, mcpRequest } from './helpers'

type ToolDef = {
  name: string
  inputSchema?: {
    properties?: Record<string, { type?: string }>
    required?: string[]
  }
}

function sampleValue(name: string, type?: string): unknown {
  if (name === 'id') return '0:1'
  if (name === 'ids') return '0:1,0:2'
  if (name === 'x' || name === 'y') return '0'
  if (name === 'width' || name === 'height' || name === 'size' || name === 'length') return '16'
  if (name === 'name') return 'SmokeTest'
  if (name === 'text') return 'Smoke'
  if (name === 'path') return 'M0 0 L10 0 L5 8 Z'
  if (name === 'color') return '#22C55E'
  if (name === 'value') return '1'
  if (name === 'file') return '/tmp/does-not-exist.png'
  if (name === 'output' || name === 'out') return '/tmp/smoke-output'
  if (name === 'component' || name === 'parent' || name === 'node' || name === 'target') return '0:1'
  if (name === 'mode') return '0:0'
  if (name === 'collection') return 'VariableCollectionId:0:0'
  if (name === 'variable') return 'VariableID:0:0'
  if (name === 'jsx') return '<Frame style={{w:10,h:10,bg:"#111"}} />'
  if (name === 'svg') return '<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="#22C55E"/></svg>'
  if (name === 'code') return 'return 1 + 1'
  if (name === 'from' || name === 'to') return '0:1'
  if (name === 'axis') return 'x'
  if (name === 'factor') return '1.1'
  if (name === 'type') return 'COLOR'
  if (name === 'prop') return 'enabled=true'
  if (name === 'align') return 'INSIDE'

  if (type === 'boolean') return true
  return '1'
}

function buildArgs(tool: ToolDef): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const properties = tool.inputSchema?.properties || {}
  const required = tool.inputSchema?.required || []

  for (const key of required) {
    args[key] = sampleValue(key, properties[key]?.type)
  }

  if (tool.name === 'figma_status' || tool.name === 'figma_page_current' || tool.name === 'figma_page_list') {
    return {}
  }

  return args
}

describe('smoke/all-tools', () => {
  let tools: ToolDef[] = []

  beforeAll(async () => {
    if (!isSmokeEnabled()) return
    await ensureMcpReady()
    const list = await mcpRequest('tools/list')
    expect(list.error).toBeUndefined()
    const result = list.result as { tools: ToolDef[] }
    tools = result.tools
    expect(tools.length).toBeGreaterThan(100)
  })

  test('every discovered tool is callable with a representative argument shape', async () => {
    if (!isSmokeEnabled()) return
    for (const tool of tools) {
      const response = await mcpRequest('tools/call', {
        name: tool.name,
        arguments: buildArgs(tool)
      })

      if (response.error) {
        expect(response.error.message.includes('Unknown tool')).toBe(false)
        continue
      }

      expect(response.result).toBeDefined()
    }
  }, 180000)
})
