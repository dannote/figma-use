import { defineCommand } from 'citty'
import { createServer } from 'http'
import { z } from 'zod'

import { getTools, getToolByName } from '../../../../mcp/src/index.ts'
import { sendCommand, getStatus, getFileKey } from '../../client.ts'
import { renderJsx } from '../../render/index.ts'

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const MCP_VERSION = '2024-11-05'
const mcpSessions = new Map<string, { initialized: boolean }>()

function splitIds(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function mapTextResizeMode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const lower = value.toLowerCase()
  if (lower === 'none') return 'NONE'
  if (lower === 'height') return 'HEIGHT'
  if (lower === 'width-and-height') return 'WIDTH_AND_HEIGHT'
  if (lower === 'truncate') return 'TRUNCATE'
  return value.toUpperCase()
}

async function handleMcpRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
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
            serverInfo: { name: 'figma-use', version: '0.8.0' },
            capabilities: { tools: {} },
            instructions:
              'Figma MCP Server. Node IDs: "sessionID:localID". Colors: hex #RRGGBB or var:Name.',
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
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            }))
          }
        }
      }

      case 'tools/call': {
        const { name, arguments: args } = params as {
          name: string
          arguments?: Record<string, unknown>
        }
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
        const properties = tool.inputSchema.properties as
          | Record<string, { type?: string }>
          | undefined
        if (args && properties) {
          for (const [key, value] of Object.entries(args)) {
            const propSchema = properties[key]
            if (propSchema?.type === 'string' && typeof value === 'string') {
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
            const statusResult = {
              connected: false,
              fileName: null as string | null,
              fileKey: null as string | null
            }
            try {
              const status = await getStatus()
              statusResult.connected = status.connected
              statusResult.fileName = status.fileName || null
              statusResult.fileKey = await getFileKey().catch(() => null)
            } catch {
              // CDP not available
            }
            result = statusResult
          } else if (tool.pluginCommand === '__render__') {
            const { jsx, x, y, parent } = coercedArgs as {
              jsx: string
              x?: string
              y?: string
              parent?: string
            }
            result = await renderJsx(jsx, {
              x: x ? Number(x) : undefined,
              y: y ? Number(y) : undefined,
              parent
            })
          } else if (name === 'figma_page_current') {
            result = await sendCommand('eval', {
              code: 'return { id: figma.currentPage.id, name: figma.currentPage.name }'
            })
          } else if (name === 'figma_node_to-component') {
            const ids = typeof coercedArgs.ids === 'string' ? coercedArgs.ids.split(/[\s,]+/).filter(Boolean) : []
            result = await sendCommand('eval', {
              code: `
                const ids = ${JSON.stringify(ids)}
                const result = []
                for (const id of ids) {
                  const node = await figma.getNodeByIdAsync(id)
                  if (node && 'createComponentFromNode' in figma) {
                    const comp = figma.createComponentFromNode(node)
                    result.push({ id: comp.id, name: comp.name })
                  }
                }
                return result
              `
            })
          } else if (tool.pluginCommand === 'set-variable-value') {
            result = await sendCommand(tool.pluginCommand, {
              ...coercedArgs,
              modeId: coercedArgs.mode,
              mode: undefined
            })
          } else if (tool.pluginCommand === 'bind-variable') {
            result = await sendCommand(tool.pluginCommand, {
              ...coercedArgs,
              nodeId: coercedArgs.node,
              variableId: coercedArgs.variable,
              node: undefined,
              variable: undefined
            })
          } else if (tool.pluginCommand === 'set-visible') {
            result = await sendCommand(tool.pluginCommand, {
              id: coercedArgs.id,
              visible: String(coercedArgs.value) === 'true'
            })
          } else if (tool.pluginCommand === 'set-locked') {
            result = await sendCommand(tool.pluginCommand, {
              id: coercedArgs.id,
              locked: String(coercedArgs.value) === 'true'
            })
          } else if (tool.pluginCommand === 'set-opacity') {
            result = await sendCommand(tool.pluginCommand, {
              id: coercedArgs.id,
              opacity: Number(coercedArgs.value)
            })
          } else if (tool.pluginCommand === 'set-corner-radius') {
            result = await sendCommand(tool.pluginCommand, {
              id: coercedArgs.id,
              cornerRadius:
                coercedArgs.radius !== undefined ? Number(coercedArgs.radius) : undefined,
              topLeftRadius:
                coercedArgs['top-left'] !== undefined
                  ? Number(coercedArgs['top-left'])
                  : undefined,
              topRightRadius:
                coercedArgs['top-right'] !== undefined
                  ? Number(coercedArgs['top-right'])
                  : undefined,
              bottomLeftRadius:
                coercedArgs['bottom-left'] !== undefined
                  ? Number(coercedArgs['bottom-left'])
                  : undefined,
              bottomRightRadius:
                coercedArgs['bottom-right'] !== undefined
                  ? Number(coercedArgs['bottom-right'])
                  : undefined
            })
          } else if (tool.pluginCommand === 'set-auto-layout') {
            let padding: { top: number; right: number; bottom: number; left: number } | undefined
            if (typeof coercedArgs.padding === 'string') {
              const parts = coercedArgs.padding.split(',').map((p) => Number(p))
              if (parts.length === 1) {
                const p = parts[0] || 0
                padding = { top: p, right: p, bottom: p, left: p }
              } else if (parts.length === 4) {
                padding = {
                  top: parts[0] || 0,
                  right: parts[1] || 0,
                  bottom: parts[2] || 0,
                  left: parts[3] || 0
                }
              }
            }
            result = await sendCommand(tool.pluginCommand, {
              id: coercedArgs.id,
              mode:
                typeof coercedArgs.mode === 'string'
                  ? coercedArgs.mode.toUpperCase()
                  : undefined,
              itemSpacing:
                coercedArgs.gap !== undefined ? Number(coercedArgs.gap) : undefined,
              padding,
              primaryAlign: coercedArgs.align,
              counterAlign: coercedArgs['counter-align'],
              wrap: coercedArgs.wrap,
              gridColumnGap:
                coercedArgs['col-gap'] !== undefined
                  ? Number(coercedArgs['col-gap'])
                  : undefined,
              gridRowGap:
                coercedArgs['row-gap'] !== undefined
                  ? Number(coercedArgs['row-gap'])
                  : undefined
            })
          } else if (tool.pluginCommand === 'set-text-auto-resize') {
            result = await sendCommand(tool.pluginCommand, {
              ...coercedArgs,
              mode: mapTextResizeMode(coercedArgs.mode)
            })
          } else if (
            tool.pluginCommand === 'zoom-to-fit' ||
            tool.pluginCommand === 'group-nodes' ||
            tool.pluginCommand === 'flatten-nodes' ||
            tool.pluginCommand === 'boolean-operation' ||
            tool.pluginCommand === 'select-nodes' ||
            tool.pluginCommand === 'clone-node' ||
            tool.pluginCommand === 'delete-node'
          ) {
            result = await sendCommand(tool.pluginCommand, {
              ...coercedArgs,
              ids: splitIds(coercedArgs.ids)
            })
          } else {
            result = await sendCommand(tool.pluginCommand, coercedArgs)
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

export default defineCommand({
  meta: { description: 'Start MCP server' },
  args: {
    port: { type: 'string', description: 'Port to listen on', default: '38451' }
  },
  async run({ args }) {
    const port = Number(args.port)

    const server = createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found. Use POST /mcp' }))
        return
      }

      let body = ''
      for await (const chunk of req) {
        body += chunk
      }

      try {
        const request = JSON.parse(body) as JSONRPCRequest
        const response = await handleMcpRequest(request)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' }
          })
        )
      }
    })

    server.listen(port, () => {
      console.log(`MCP server listening on http://localhost:${port}/mcp`)
      console.log('')
      console.log('Add to your MCP client config:')
      console.log(
        JSON.stringify(
          {
            mcpServers: {
              'figma-use': {
                url: `http://localhost:${port}/mcp`
              }
            }
          },
          null,
          2
        )
      )
    })

    // Keep process alive
    await new Promise(() => {})
  }
})
