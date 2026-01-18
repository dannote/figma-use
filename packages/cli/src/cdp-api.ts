import WebSocket from 'ws'

interface CDPTarget {
  webSocketDebuggerUrl: string
  url: string
}

async function getCDPTarget(): Promise<CDPTarget> {
  const resp = await fetch('http://localhost:9222/json')
  const targets = await resp.json() as CDPTarget[]
  
  const figmaTarget = targets.find(t => 
    t.url.includes('figma.com/design') || t.url.includes('figma.com/file')
  )
  
  if (!figmaTarget) {
    throw new Error('No Figma file open. Start Figma with --remote-debugging-port=9222')
  }
  
  return figmaTarget
}

function getFileKeyFromUrl(url: string): string {
  const match = url.match(/\/(file|design)\/([a-zA-Z0-9]+)/)
  if (!match?.[2]) throw new Error('Could not extract file key from URL')
  return match[2]
}

async function cdpEval<T>(expression: string): Promise<T> {
  const target = await getCDPTarget()
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('CDP timeout'))
    }, 10000)
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true
        }
      }))
    })
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === 1) {
        clearTimeout(timeout)
        ws.close()
        
        if (msg.result?.exceptionDetails) {
          reject(new Error(msg.result.exceptionDetails.text))
        } else {
          resolve(msg.result?.result?.value as T)
        }
      }
    })
    
    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function getFileKeyFromBrowser(): Promise<string> {
  const target = await getCDPTarget()
  return getFileKeyFromUrl(target.url)
}

export interface BrowserComment {
  id: string
  file_key: string
  parent_id?: string
  user: { id: string; handle: string; img_url: string }
  created_at: string
  resolved_at?: string
  message: string
  client_meta?: { node_id?: string }
}

export async function getCommentsViaBrowser(fileKey?: string): Promise<BrowserComment[]> {
  const key = fileKey || await getFileKeyFromBrowser()
  
  // Use CDP to make the fetch from within Figma's page context
  // This bypasses CORS and uses the session cookies
  const result = await cdpEval<{ comments?: BrowserComment[]; error?: string }>(`
    (async () => {
      try {
        // Figma's internal comment fetching uses their own transport
        // Let's try to find it in their app state
        
        // First approach: Access Figma's React fiber to find comment data
        const root = document.getElementById('react-page');
        if (!root) return { error: 'No react root' };
        
        // Get file key from URL
        const fileKey = '${key}';
        
        // Try to access comments through Figma's GraphQL/internal API
        // Figma uses a custom WebSocket protocol for most data
        
        // For now, return empty - we need to investigate the internal data store
        return { comments: [], note: 'Browser API access requires further investigation' };
      } catch (e) {
        return { error: e.message };
      }
    })()
  `)
  
  if (result.error) throw new Error(result.error)
  return result.comments || []
}

export async function getCurrentUser(): Promise<{ id: string; name: string; email: string; handle: string }> {
  return cdpEval(`window.INITIAL_OPTIONS?.user_data`)
}

export interface FileInfo {
  key: string
  name: string
  lastModified?: string
}

export async function getFileInfoViaBrowser(): Promise<FileInfo> {
  const target = await getCDPTarget()
  const key = getFileKeyFromUrl(target.url)
  
  const name = await cdpEval<string>(`document.title.replace(' – Figma', '').replace(' - Figma', '')`)
  
  return { key, name: name || 'Untitled' }
}

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

export async function getComments(fileKey?: string): Promise<Comment[]> {
  const key = fileKey || await getFileKeyFromBrowser()
  
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

export async function postComment(message: string, options?: { 
  fileKey?: string
  nodeId?: string 
  x?: number
  y?: number
  replyTo?: string
}): Promise<Comment> {
  const key = options?.fileKey || await getFileKeyFromBrowser()
  const x = options?.x ?? 100
  const y = options?.y ?? 100
  const nodeId = options?.nodeId || '0:1'
  
  const body = {
    file_key: key,
    message_meta: [{ t: message }],
    attachments: [],
    client_meta: {
      x, y,
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
  const key = fileKey || await getFileKeyFromBrowser()
  
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
