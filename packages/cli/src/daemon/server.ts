import { existsSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import { createServer, Server, Socket } from 'net'

import { closeCDP } from '../cdp.ts'
import { sendCommandDirect } from '../client.ts'

const SOCKET_PATH = '/tmp/figma-use.sock'
const PID_FILE = '/tmp/figma-use.pid'

let server: Server | null = null

interface Request {
  id: string
  command: string
  args?: unknown
}

interface Response {
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

function handleConnection(socket: Socket): void {
  let buffer = ''

  socket.on('data', async (data) => {
    buffer += data.toString()

    // Handle multiple JSON messages in buffer (newline-delimited)
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const req: Request = JSON.parse(line)
        const response: Response = { id: req.id, ok: true }

        try {
          // Use direct command (no daemon loop, cached RPC)
          response.result = await sendCommandDirect(req.command, req.args)
        } catch (e) {
          response.ok = false
          response.error = e instanceof Error ? e.message : String(e)
        }

        socket.write(JSON.stringify(response) + '\n')
      } catch (e) {
        socket.write(JSON.stringify({ id: 'error', ok: false, error: 'Invalid JSON' }) + '\n')
      }
    }
  })

  socket.on('error', () => {
    // Client disconnected
  })
}

export async function startDaemon(): Promise<void> {
  // Clean up existing socket
  if (existsSync(SOCKET_PATH)) {
    unlinkSync(SOCKET_PATH)
  }

  // Pre-warm: build RPC and connect to Figma once
  try {
    const page = await sendCommandDirect('get-current-page', {})
    console.log('Connected to Figma, page:', (page as any)?.name || 'unknown')
  } catch (e) {
    console.error('Failed to connect to Figma:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  server = createServer(handleConnection)

  server.listen(SOCKET_PATH, () => {
    // Write PID file
    writeFileSync(PID_FILE, String(process.pid))
    console.log(`Daemon started (PID ${process.pid})`)
    console.log(`Socket: ${SOCKET_PATH}`)
  })

  server.on('error', (e) => {
    console.error('Daemon error:', e.message)
    process.exit(1)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await closeCDP()
    if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH)
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

export function stopDaemon(): boolean {
  if (!existsSync(PID_FILE)) {
    return false
  }

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8'))

  try {
    process.kill(pid, 'SIGTERM')
    // Clean up files
    if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH)
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
    return true
  } catch {
    // Process not running, clean up stale files
    if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH)
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
    return false
  }
}

export function isDaemonRunning(): boolean {
  if (!existsSync(PID_FILE)) return false

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8'))

  try {
    process.kill(pid, 0) // Check if process exists
    return true
  } catch {
    return false
  }
}

export function getDaemonInfo(): { pid: number; socket: string } | null {
  if (!isDaemonRunning()) return null

  return {
    pid: parseInt(readFileSync(PID_FILE, 'utf-8')),
    socket: SOCKET_PATH
  }
}
