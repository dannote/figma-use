import { Elysia } from 'elysia'
import { consola } from 'consola'

const PORT = Number(process.env.PORT) || 38451

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

    const { command, args } = body as { command: string; args?: unknown }
    const id = crypto.randomUUID()

    consola.info(`${command}`, args || '')

    try {
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }, 10000)

        pendingRequests.set(id, { resolve, reject, timeout })
        sendToPlugin!(JSON.stringify({ id, command, args }))
      })

      return { result }
    } catch (e) {
      consola.error(`${command} failed:`, e instanceof Error ? e.message : e)
      return { error: e instanceof Error ? e.message : String(e) }
    }
  })
  .get('/status', () => ({
    pluginConnected: sendToPlugin !== null
  }))
  .listen(PORT)

consola.start(`Proxy server running on http://localhost:${PORT}`)
