import { describe, test, expect, beforeAll } from 'bun:test'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { getTools } from '../src/index.ts'

const MCP_SCHEMA_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/specification/main/schema/2024-11-05/schema.json'

let ajv: Ajv
let schema: Record<string, unknown>

beforeAll(async () => {
  const res = await fetch(MCP_SCHEMA_URL)
  schema = await res.json() as Record<string, unknown>
  
  ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  ajv.addSchema(schema, 'mcp')
})

describe('MCP Schema Validation', () => {
  test('tools/list response matches ListToolsResult schema', async () => {
    const tools = await getTools()
    
    const response = {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))
    }
    
    const validate = ajv.compile({ $ref: 'mcp#/definitions/ListToolsResult' })
    const valid = validate(response)
    
    if (!valid) {
      console.error('Validation errors:', validate.errors)
    }
    
    expect(valid).toBe(true)
  })
  
  test('each tool matches Tool schema', async () => {
    const tools = await getTools()
    const validate = ajv.compile({ $ref: 'mcp#/definitions/Tool' })
    
    for (const tool of tools) {
      const toolObj = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }
      
      const valid = validate(toolObj)
      
      if (!valid) {
        console.error(`Tool ${tool.name} validation errors:`, validate.errors)
      }
      
      expect(valid).toBe(true)
    }
  })
  
  test('tool call result matches CallToolResult schema', () => {
    const validate = ajv.compile({ $ref: 'mcp#/definitions/CallToolResult' })
    
    const successResult = {
      content: [{ type: 'text', text: '{"id": "1:2", "name": "Frame"}' }],
      isError: false
    }
    
    expect(validate(successResult)).toBe(true)
    
    const errorResult = {
      content: [{ type: 'text', text: 'Plugin not connected' }],
      isError: true
    }
    
    expect(validate(errorResult)).toBe(true)
  })
  
  test('initialize response matches InitializeResult schema', () => {
    const validate = ajv.compile({ $ref: 'mcp#/definitions/InitializeResult' })
    
    const response = {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'figma-use', version: '0.5.3' },
      capabilities: { tools: {} },
      instructions: 'Figma MCP Server. Node IDs: "sessionID:localID". Colors: hex #RRGGBB.'
    }
    
    const valid = validate(response)
    
    if (!valid) {
      console.error('InitializeResult validation errors:', validate.errors)
    }
    
    expect(valid).toBe(true)
  })
  
  test('tool names follow naming conventions', async () => {
    const tools = await getTools()
    const validNamePattern = /^[A-Za-z0-9_\-.]+$/
    
    for (const tool of tools) {
      expect(tool.name.length).toBeGreaterThanOrEqual(1)
      expect(tool.name.length).toBeLessThanOrEqual(128)
      expect(validNamePattern.test(tool.name)).toBe(true)
    }
  })
})
