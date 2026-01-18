import { Elysia } from 'elysia'
import { consola } from 'consola'
import { z } from 'zod'
import type { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js'
import { getTools, getToolByName, type ToolDef } from '../../mcp/src/index.ts'
import { getMultiplayerConnection, getConnectionStatus, closeAllConnections, type NodeChange } from './multiplayer.ts'

const PORT = Number(process.env.PORT) || 38451
const MCP_VERSION = '2024-11-05'

const TIMEOUT_LIGHT = 10_000
const TIMEOUT_HEAVY = 120_000

const HEAVY_COMMANDS = new Set([
  'export-node',
  'screenshot', 
  'export-selection',
  'eval'
])

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const pendingRequests = new Map<string, PendingRequest>()
let sendToPlugin: ((data: string) => void) | null = null

async function executeCommand<T = unknown>(command: string, args?: unknown): Promise<T> {
  if (!sendToPlugin) {
    throw new Error('Plugin not connected')
  }

  const id = crypto.randomUUID()
  const defaultTimeout = HEAVY_COMMANDS.has(command) ? TIMEOUT_HEAVY : TIMEOUT_LIGHT

  const result = await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('Request timeout'))
    }, defaultTimeout)

    pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout })
    sendToPlugin!(JSON.stringify({ id, command, args }))
  })

  return result
}

const mcpSessions = new Map<string, { initialized: boolean }>()

async function handleMcpRequest(req: JSONRPCRequest, sessionId?: string): Promise<JSONRPCResponse> {
  const { id, method, params } = req
  
  try {
    switch (method) {
      case 'initialize': {
        const newSessionId = crypto.randomUUID()
        mcpSessions.set(newSessionId, { initialized: true })
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_VERSION,
            serverInfo: { name: 'figma-use', version: '0.5.5' },
            capabilities: { tools: {} },
            instructions: 'Figma MCP Server. Node IDs: "sessionID:localID". Colors: hex #RRGGBB.',
            sessionId: newSessionId
          }
        }
      }
      
      case 'tools/list': {
        const tools = await getTools()
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            }))
          }
        }
      }
      
      case 'tools/call': {
        const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> }
        const tool = getToolByName(name)
        
        if (!tool) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unknown tool: ${name}` }
          }
        }
        
        // Coerce string args to numbers where schema expects them
        const coercedArgs: Record<string, unknown> = {}
        if (args && tool.inputSchema.properties) {
          for (const [key, value] of Object.entries(args)) {
            const propSchema = tool.inputSchema.properties[key]
            if (propSchema?.type === 'string' && typeof value === 'string') {
              // Try to coerce numeric strings to numbers (CLI uses string type but plugin expects numbers)
              const parsed = z.coerce.number().safeParse(value)
              coercedArgs[key] = parsed.success ? parsed.data : value
            } else {
              coercedArgs[key] = value
            }
          }
        } else if (args) {
          Object.assign(coercedArgs, args)
        }
        
        try {
          let result: unknown
          
          if (tool.pluginCommand === '__status__') {
            result = { pluginConnected: sendToPlugin !== null }
          } else {
            result = await executeCommand(tool.pluginCommand, coercedArgs)
          }
          
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false
            }
          }
        } catch (e) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
              isError: true
            }
          }
        }
      }
      
      case 'notifications/initialized':
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} }
      
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        }
    }
  } catch (e) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: e instanceof Error ? e.message : 'Internal error' }
    }
  }
}

new Elysia()
  .ws('/plugin', {
    open(ws) {
      consola.success('Plugin connected')
      sendToPlugin = (data) => ws.send(data)
    },
    close() {
      consola.warn('Plugin disconnected')
      sendToPlugin = null
    },
    message(ws, message) {
      const msgStr = typeof message === 'string' ? message : JSON.stringify(message)
      const data = JSON.parse(msgStr) as { id: string; result?: unknown; error?: string }
      const pending = pendingRequests.get(data.id)
      if (!pending) return

      clearTimeout(pending.timeout)
      pendingRequests.delete(data.id)

      if (data.error) {
        pending.reject(new Error(data.error))
      } else {
        pending.resolve(data.result)
      }
    }
  })
  .post('/command', async ({ body }) => {
    const { command, args } = body as { command: string; args?: unknown }
    consola.info(`${command}`, args || '')

    try {
      const result = await executeCommand(command, args)
      return { result }
    } catch (e) {
      consola.error(`${command} failed:`, e instanceof Error ? e.message : e)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  .post('/batch', async ({ body }) => {
    if (!sendToPlugin) {
      return { error: 'Plugin not connected' }
    }

    const { commands, timeout: customTimeout } = body as { 
      commands: Array<{ command: string; args?: unknown; parentRef?: string }>
      timeout?: number 
    }
    const id = crypto.randomUUID()

    consola.info(`batch: ${commands.length} commands`)

    try {
      const timeoutMs = customTimeout || TIMEOUT_HEAVY
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }, timeoutMs)

        pendingRequests.set(id, { resolve, reject, timeout })
        sendToPlugin!(JSON.stringify({ id, command: 'batch', args: { commands } }))
      })

      return { result }
    } catch (e) {
      consola.error('batch failed:', e instanceof Error ? e.message : e)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  .get('/status', () => ({
    pluginConnected: sendToPlugin !== null,
    multiplayer: getConnectionStatus()
  }))
  .post('/render', async ({ body }) => {
    const { fileKey, nodeChanges, parentGUID } = body as {
      fileKey: string
      nodeChanges: NodeChange[]
      parentGUID?: { sessionID: number; localID: number }
    }
    
    if (!fileKey) {
      return { error: 'fileKey is required' }
    }
    
    if (!nodeChanges || !Array.isArray(nodeChanges)) {
      return { error: 'nodeChanges array is required' }
    }
    
    for (const nc of nodeChanges) {
      if (!nc.guid?.sessionID || !nc.guid?.localID) {
        return { error: 'Each nodeChange must have guid.sessionID and guid.localID' }
      }
    }
    
    try {
      const { client, sessionID } = await getMultiplayerConnection(fileKey)
      
      consola.info(`render: ${nodeChanges.length} nodes to ${fileKey}`)
      
      await client.sendNodeChangesSync(nodeChanges)
      
      if (sendToPlugin) {
        const rootId = `${nodeChanges[0].guid.sessionID}:${nodeChanges[0].guid.localID}`
        const layoutId = crypto.randomUUID()
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              pendingRequests.delete(layoutId)
              reject(new Error('Layout trigger timeout'))
            }, 5000)
            pendingRequests.set(layoutId, { resolve: () => resolve(), reject, timeout })
            sendToPlugin!(JSON.stringify({ 
              id: layoutId, 
              command: 'trigger-layout', 
              args: { 
                nodeId: rootId,
                pendingComponentSetInstances: (body as any).pendingComponentSetInstances || []
              } 
            }))
          })
        } catch {
          // Layout trigger failed, nodes will overlap but still work
        }
      }
      
      const ids = nodeChanges.map(nc => ({
        id: `${nc.guid.sessionID}:${nc.guid.localID}`,
        name: nc.name,
      }))
      
      return { 
        result: { 
          count: nodeChanges.length,
          sessionID,
          nodes: ids 
        } 
      }
    } catch (e) {
      consola.error('render failed:', e instanceof Error ? e.message : e)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  .post('/mcp', async ({ body, request }) => {
    const sessionId = request.headers.get('mcp-session-id') || undefined
    const req = body as JSONRPCRequest
    
    consola.info(`MCP: ${req.method}`, req.params ? JSON.stringify(req.params).slice(0, 100) : '')
    
    const response = await handleMcpRequest(req, sessionId)
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (response.result && typeof response.result === 'object' && 'sessionId' in response.result) {
      headers['mcp-session-id'] = (response.result as any).sessionId
    }
    
    return new Response(JSON.stringify(response), { headers })
  })
  .listen(PORT)

consola.start(`Proxy server running on http://localhost:${PORT}`)
consola.info(`MCP endpoint: http://localhost:${PORT}/mcp`)
