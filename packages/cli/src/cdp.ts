import { figmaLaunchHint } from './format.ts'
import {
  pipeEval,
  getPipeFileKey,
  closePipe,
  ensurePipeConnected
} from './cdp-pipe.ts'
import { isFigmaPatched } from './patch-figma.ts'

let pipeMode: boolean | null = null

export function usePipeTransport(): void {
  pipeMode = true
}

function isPipeMode(): boolean {
  if (pipeMode !== null) return pipeMode
  if (process.env.FIGMA_PIPE === '1') {
    pipeMode = true
    return true
  }
  pipeMode = false
  return false
}

interface CDPTarget {
  webSocketDebuggerUrl: string
  url: string
  type: string
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let cachedWs: WebSocket | null = null
let cachedTarget: CDPTarget | null = null
let messageId = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null
const IDLE_TIMEOUT = 100

const pendingRequests = new Map<number, PendingRequest>()

async function getCDPTarget(): Promise<CDPTarget> {
  if (cachedTarget) return cachedTarget

  let resp: Response
  try {
    resp = await fetch('http://localhost:9222/json')
  } catch {
    const patched = isFigmaPatched()
    if (patched === false) {
      throw new Error(
        'Figma blocks remote debugging in this version.\n' +
          'Run `figma-use patch` to fix, then restart Figma.'
      )
    }
    throw new Error(
      'Cannot connect to Figma on port 9222.\n' +
        `Start Figma with: ${figmaLaunchHint()}`
    )
  }

  const targets = (await resp.json()) as CDPTarget[]

  const figmaTarget =
    targets.find((t) => t.type === 'page' && t.url.includes('figma.com/design')) ||
    targets.find((t) => t.type === 'page' && t.url.includes('figma.com/file')) ||
    targets.find((t) => t.type === 'page' && t.url.includes('figma.com/board'))

  if (!figmaTarget) {
    throw new Error(
      'No Figma file open in browser.\n' + `Start Figma with: ${figmaLaunchHint()}`
    )
  }

  cachedTarget = figmaTarget
  return figmaTarget
}

function handleMessage(event: MessageEvent): void {
  const msg = JSON.parse(event.data)
  if (typeof msg.id !== 'number') return

  const pending = pendingRequests.get(msg.id)
  if (!pending) return

  pendingRequests.delete(msg.id)
  clearTimeout(pending.timer)
  scheduleClose()

  if (msg.result?.exceptionDetails) {
    const err = msg.result.exceptionDetails
    pending.reject(new Error(err.exception?.description || err.text || 'CDP error'))
  } else {
    pending.resolve(msg.result?.result?.value)
  }
}

async function getWebSocket(): Promise<WebSocket> {
  if (cachedWs?.readyState === WebSocket.OPEN) return cachedWs

  const target = await getCDPTarget()

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl)

    ws.addEventListener('open', () => {
      cachedWs = ws
      ws.addEventListener('message', handleMessage)
      resolve(ws)
    })

    ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')))

    ws.addEventListener('close', () => {
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error('WebSocket closed'))
        pendingRequests.delete(id)
      }
      if (cachedWs === ws) {
        cachedWs = null
      }
    })
  })
}

function scheduleClose(): void {
  if (pendingRequests.size > 0) return
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    closeCDP()
  }, IDLE_TIMEOUT)
}

export async function cdpEval<T>(code: string, timeout = 30000): Promise<T> {
  if (isPipeMode()) return pipeEval<T>(code, timeout)

  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }

  const ws = await getWebSocket()
  const id = ++messageId

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      scheduleClose()
      reject(new Error('CDP timeout'))
    }, timeout)

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer
    })

    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression: code,
          awaitPromise: true,
          returnByValue: true
        }
      })
    )
  })
}

export function getFileKeyFromUrl(url: string): string {
  const match = url.match(/\/(file|design)\/([a-zA-Z0-9]+)/)
  if (!match?.[2]) throw new Error('Could not extract file key from URL')
  return match[2]
}

export async function getFileKey(): Promise<string> {
  if (isPipeMode()) {
    await ensurePipeConnected()
    const key = getPipeFileKey()
    if (!key) throw new Error('Could not extract file key from Figma')
    return key
  }
  const target = await getCDPTarget()
  return getFileKeyFromUrl(target.url)
}

export function closeCDP(): void {
  if (isPipeMode()) {
    closePipe()
    return
  }
  if (cachedWs) {
    cachedWs.close()
    cachedWs = null
  }
  cachedTarget = null
}

// --- Figma browser API (comments, versions, user, plugins) ---

export interface User {
  id: string
  handle: string
  img_url: string
}

export interface Comment {
  id: string
  file_key: string
  parent_id: string | null
  user: User
  created_at: string
  resolved_at: string | null
  message: string
  order_id: string | null
  reactions: { user: User; emoji: string; created_at: string }[]
  client_meta: { node_id?: string; x?: number; y?: number } | null
}

interface InternalComment {
  id: string
  key: string
  parent_id: string | null
  user: User
  created_at: string
  resolved_at: string | null
  message: string
  order_id: string | null
  reactions: { user: User; emoji: string; created_at: string }[]
  client_meta: { node_id?: string; x?: number; y?: number } | null
}

function mapComment(c: InternalComment): Comment {
  return {
    id: c.id,
    file_key: c.key,
    parent_id: c.parent_id,
    user: c.user,
    created_at: c.created_at,
    resolved_at: c.resolved_at,
    message: c.message,
    order_id: c.order_id,
    reactions: c.reactions || [],
    client_meta: c.client_meta
  }
}

export async function getCurrentUser(): Promise<{
  id: string
  name: string
  email: string
  handle: string
}> {
  return cdpEval(`window.INITIAL_OPTIONS?.user_data`)
}

export interface FileInfo {
  key: string
  name: string
  lastModified?: string
}

export async function getFileInfo(): Promise<FileInfo> {
  const key = await getFileKey()
  const name = await cdpEval<string>(
    `document.title.replace(' – Figma', '').replace(' - Figma', '')`
  )
  return { key, name: name || 'Untitled' }
}

export async function getComments(fileKey?: string): Promise<Comment[]> {
  const key = fileKey || (await getFileKey())

  const result = await cdpEval<{ meta: InternalComment[]; error?: boolean }>(`
    (async () => {
      const resp = await fetch('https://www.figma.com/api/file/${key}/comments', {
        credentials: 'include'
      });
      return await resp.json();
    })()
  `)

  if (result.error) throw new Error('Failed to fetch comments')
  return (result.meta || []).map(mapComment)
}

export async function postComment(
  message: string,
  options?: {
    fileKey?: string
    nodeId?: string
    x?: number
    y?: number
    replyTo?: string
  }
): Promise<Comment> {
  const key = options?.fileKey || (await getFileKey())
  const x = options?.x ?? 100
  const y = options?.y ?? 100
  const nodeId = options?.nodeId || '0:1'

  const body = {
    file_key: key,
    message_meta: [{ t: message }],
    attachments: [],
    client_meta: {
      x,
      y,
      node_id: nodeId,
      node_offset: { x, y },
      page_id: nodeId.includes(':') ? nodeId : '0:1'
    },
    ...(options?.replyTo && { parent_id: options.replyTo })
  }

  const result = await cdpEval<{ meta: InternalComment; error?: boolean }>(`
    (async () => {
      const resp = await fetch('https://www.figma.com/api/file/${key}/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(${JSON.stringify(body)})
      });
      return await resp.json();
    })()
  `)

  if (result.error) throw new Error('Failed to post comment')
  return mapComment(result.meta)
}

export async function deleteComment(commentId: string, fileKey?: string): Promise<void> {
  const key = fileKey || (await getFileKey())

  const result = await cdpEval<{ error?: boolean }>(`
    (async () => {
      const resp = await fetch('https://www.figma.com/api/file/${key}/comments/${commentId}', {
        method: 'DELETE',
        credentials: 'include'
      });
      return await resp.json();
    })()
  `)

  if (result.error) throw new Error('Failed to delete comment')
}

export async function resolveComment(commentId: string, fileKey?: string): Promise<void> {
  const key = fileKey || (await getFileKey())

  const result = await cdpEval<{ error?: boolean }>(`
    (async () => {
      const resp = await fetch('https://www.figma.com/api/file/${key}/comments/${commentId}', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_at: new Date().toISOString() })
      });
      return await resp.json();
    })()
  `)

  if (result.error) throw new Error('Failed to resolve comment')
}

export interface Version {
  id: string
  created_at: string
  label: string | null
  description: string | null
  user: User
}

export async function getVersions(fileKey?: string, limit = 20): Promise<Version[]> {
  const key = fileKey || (await getFileKey())

  const result = await cdpEval<{ meta?: { versions: Version[] }; error?: boolean }>(`
    (async () => {
      const resp = await fetch('https://www.figma.com/api/versions/${key}?page_size=${limit}', {
        credentials: 'include'
      });
      return await resp.json();
    })()
  `)

  if (result.error) throw new Error('Failed to fetch versions')
  return result.meta?.versions || []
}

const WEBPACK_INIT = `
if (!window.__webpackRequire__) {
  window.webpackChunk_figma_web_bundler.push([
    ['__figma_use_' + Date.now()], {},
    r => window.__webpackRequire__ = r
  ]);
}
`

const WEBPACK_FIND = `
window.__findExport = (signature, predicate) => {
  const r = window.__webpackRequire__;
  for (const id in r.m) {
    if (r.m[id].toString().includes(signature)) {
      const hit = Object.values(r(id)).find(predicate);
      if (hit) return hit;
    }
  }
};
`

export async function initWebpackAccess(): Promise<void> {
  await cdpEval(WEBPACK_INIT + WEBPACK_FIND)
}

export interface LocalPlugin {
  name: string
  plugin_id: string
  localFileId: number
  localFilePath: string
  manifest: {
    id: string
    name: string
    main: string
    ui?: string
  }
}

export async function getLocalPlugins(): Promise<LocalPlugin[]> {
  await initWebpackAccess()

  const result = await cdpEval<{ plugins: LocalPlugin[] } | { error: string }>(`
    (() => {
      const store = window.__findExport(
        'intended only for debugging',
        v => v?.getState?.()?.localPlugins
      );
      if (!store) return { error: 'Store not found' };

      const state = store.getState();
      const plugins = Object.values(state.localPlugins || {});
      return { plugins };
    })()
  `)

  if ('error' in result) throw new Error(result.error)
  return result.plugins
}

export async function runLocalPlugin(pluginName: string): Promise<void> {
  await initWebpackAccess()

  const result = await cdpEval<{ ok: true; name: string } | { error: string }>(`
    (() => {
      const store = window.__findExport(
        'intended only for debugging',
        v => v?.getState?.()?.localPlugins
      );
      const run = window.__findExport(
        'Plugin Start Initiated',
        v => typeof v === 'function' && v.toString().includes('Plugin Start')
      );

      if (!store || !run) return { error: 'Figma internals not found' };

      const state = store.getState();
      const plugin = Object.values(state.localPlugins || {}).find(p => p.name === '${pluginName}');

      if (!plugin) return { error: 'Plugin not found: ${pluginName}' };

      run({
        plugin,
        openFileKey: state.openFile?.key,
        isWidget: false,
        triggeredFrom: 'quick-actions'
      });

      return { ok: true, name: plugin.name };
    })()
  `)

  if ('error' in result) throw new Error(result.error)
}
