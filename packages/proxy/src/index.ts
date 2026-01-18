import { Elysia } from 'elysia'
import { consola } from 'consola'
import { getMultiplayerConnection, getConnectionStatus, closeAllConnections, type NodeChange } from './multiplayer.ts'

const PORT = Number(process.env.PORT) || 38451

const TIMEOUT_LIGHT = 10_000   // 10s for most operations
const TIMEOUT_HEAVY = 120_000  // 2min for export/screenshot

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
      if (!pending) {
        return
      }

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
    if (!sendToPlugin) {
      return { error: 'Plugin not connected' }
    }

    const { command, args, timeout: customTimeout } = body as { command: string; args?: unknown; timeout?: number }
    const id = crypto.randomUUID()

    consola.info(`${command}`, args || '')

    try {
      const defaultTimeout = HEAVY_COMMANDS.has(command) ? TIMEOUT_HEAVY : TIMEOUT_LIGHT
      const timeoutMs = customTimeout || defaultTimeout
      consola.info(`Timeout: ${timeoutMs}ms (custom: ${customTimeout}, default: ${defaultTimeout})`)
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }, timeoutMs)

        pendingRequests.set(id, { resolve, reject, timeout })
        sendToPlugin!(JSON.stringify({ id, command, args }))
      })

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
    
    // Basic validation - each node must have guid
    for (const nc of nodeChanges) {
      if (!nc.guid?.sessionID || !nc.guid?.localID) {
        return { error: 'Each nodeChange must have guid.sessionID and guid.localID' }
      }
    }
    
    try {
      const { client, sessionID } = await getMultiplayerConnection(fileKey)
      
      consola.info(`render: ${nodeChanges.length} nodes to ${fileKey}`)
      
      await client.sendNodeChangesSync(nodeChanges)
      
      // Trigger layout recalculation via plugin (multiplayer doesn't auto-apply)
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
            sendToPlugin!(JSON.stringify({ id: layoutId, command: 'trigger-layout', args: { nodeId: rootId } }))
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
  .listen(PORT)

consola.start(`Proxy server running on http://localhost:${PORT}`)
