/**
 * Multiplayer connection pool for proxy server
 * 
 * Holds persistent WebSocket connections to Figma multiplayer servers.
 * Connections are created lazily and reused across render requests.
 */

import { consola } from 'consola'

// Re-export types needed by proxy
export type { NodeChange } from '../../cli/src/multiplayer/codec.ts'

// Lazy imports to avoid loading heavy modules until needed
let FigmaMultiplayerClient: typeof import('../../cli/src/multiplayer/client.ts').FigmaMultiplayerClient
let getCookiesFromDevTools: typeof import('../../cli/src/multiplayer/client.ts').getCookiesFromDevTools
let initCodec: typeof import('../../cli/src/multiplayer/codec.ts').initCodec

interface PooledConnection {
  client: InstanceType<typeof FigmaMultiplayerClient>
  sessionID: number
  fileKey: string
  lastUsed: number
}

const connectionPool = new Map<string, PooledConnection>()
const CONNECTION_TTL = 5 * 60 * 1000 // 5 minutes idle timeout
let initialized = false

async function ensureInitialized() {
  if (initialized) return
  
  const clientModule = await import('../../cli/src/multiplayer/client.ts')
  const codecModule = await import('../../cli/src/multiplayer/codec.ts')
  
  FigmaMultiplayerClient = clientModule.FigmaMultiplayerClient
  getCookiesFromDevTools = clientModule.getCookiesFromDevTools
  initCodec = codecModule.initCodec
  
  await initCodec()
  initialized = true
  
  // Cleanup idle connections periodically
  setInterval(cleanupIdleConnections, 60_000)
}

function cleanupIdleConnections() {
  const now = Date.now()
  for (const [key, conn] of connectionPool) {
    if (now - conn.lastUsed > CONNECTION_TTL) {
      consola.info(`Closing idle multiplayer connection: ${key}`)
      conn.client.close()
      connectionPool.delete(key)
    }
  }
}

export async function getMultiplayerConnection(fileKey: string): Promise<{
  client: InstanceType<typeof FigmaMultiplayerClient>
  sessionID: number
}> {
  await ensureInitialized()
  
  // Close connections to OTHER files (user switched files)
  for (const [key, conn] of connectionPool) {
    if (key !== fileKey) {
      consola.info(`Closing stale connection to ${key} (switched to ${fileKey})`)
      conn.client.close()
      connectionPool.delete(key)
    }
  }
  
  // Check for existing connection to this file
  const existing = connectionPool.get(fileKey)
  if (existing) {
    // Verify connection is still alive
    if (existing.client.isConnected()) {
      existing.lastUsed = Date.now()
      consola.debug(`Reusing multiplayer connection for ${fileKey}`)
      return { client: existing.client, sessionID: existing.sessionID }
    } else {
      // Connection died, remove it
      consola.warn(`Multiplayer connection to ${fileKey} died, reconnecting...`)
      connectionPool.delete(fileKey)
    }
  }
  
  // Create new connection
  consola.info(`Creating multiplayer connection for ${fileKey}`)
  
  const cookies = await getCookiesFromDevTools()
  const client = new FigmaMultiplayerClient(fileKey)
  const session = await client.connect(cookies)
  
  connectionPool.set(fileKey, {
    client,
    sessionID: session.sessionID,
    fileKey,
    lastUsed: Date.now(),
  })
  
  consola.success(`Multiplayer connected: sessionID=${session.sessionID}`)
  
  return { client, sessionID: session.sessionID }
}

export function closeAllConnections() {
  for (const [key, conn] of connectionPool) {
    conn.client.close()
    connectionPool.delete(key)
  }
  consola.info('All multiplayer connections closed')
}

export function getConnectionStatus(): { 
  connections: Array<{ fileKey: string; sessionID: number; idleMs: number }> 
} {
  const now = Date.now()
  return {
    connections: Array.from(connectionPool.values()).map(conn => ({
      fileKey: conn.fileKey,
      sessionID: conn.sessionID,
      idleMs: now - conn.lastUsed,
    }))
  }
}
