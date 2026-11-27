import { existsSync } from 'fs'
import { createConnection, Socket } from 'net'

import { getCdpPort } from '../cdp.ts'
import { getDaemonPaths } from './paths.ts'

const {
  socketPath: SOCKET_PATH,
  pidFile: PID_FILE,
  isNamedPipe: IS_NAMED_PIPE
} = getDaemonPaths()

export function isDaemonAvailable(): boolean {
  // On Windows, existsSync() on a named pipe path can fail or block;
  // check the PID file written once the named pipe server is listening.
  return IS_NAMED_PIPE ? existsSync(PID_FILE) : existsSync(SOCKET_PATH)
}

export async function callDaemon<T = unknown>(command: string, args?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const client: Socket = createConnection(SOCKET_PATH)
    let buffer = ''
    let connected = false

    // Short connection timeout - if daemon doesn't respond quickly, fall back
    const connectTimeout = setTimeout(() => {
      if (!connected) {
        client.destroy()
        reject(new Error('Daemon connection timeout'))
      }
    }, 100)

    const timeout = setTimeout(() => {
      client.destroy()
      reject(new Error('Daemon request timeout'))
    }, 30000)

    client.on('connect', () => {
      connected = true
      clearTimeout(connectTimeout)
      // Include the requested CDP port so the daemon can detect a mismatch.
      client.write(JSON.stringify({ id, command, args, port: getCdpPort() }) + '\n')
    })

    client.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const response = JSON.parse(line)
          if (response.id === id) {
            clearTimeout(timeout)
            client.end()
            if (response.ok) {
              resolve(response.result as T)
            } else {
              reject(new Error(response.error))
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    })

    client.on('error', (e) => {
      clearTimeout(timeout)
      reject(new Error(`Daemon connection failed: ${e.message}`))
    })
  })
}
