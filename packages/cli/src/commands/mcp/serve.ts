import { defineCommand } from 'citty'
import { createServer } from 'http'
import { z } from 'zod'

import { getTools, getToolByName } from '../../../../mcp/src/index.ts'
import { sendCommand } from '../../client.ts'
import { renderJsx } from '../../render/index.ts'

import type { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js'

const MCP_VERSION = '2024-11-05'
const mcpSessions = new Map<string, { initialized: boolean }>()

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
        if (args && tool.inputSchema.properties) {
          for (const [key, value] of Object.entries(args)) {
            const propSchema = tool.inputSchema.properties[key] as { type?: string } | undefined
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
            result = await sendCommand('status')
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
