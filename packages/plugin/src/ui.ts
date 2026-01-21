const PROXY_URL = 'ws://localhost:38451/plugin'

console.log('[Figma Bridge] UI loaded')

let ws: WebSocket | null = null
let statusEl: HTMLElement | null = null
let currentSessionId: string | null = null
let currentFileName: string | null = null

function connect() {
  ws = new WebSocket(PROXY_URL)

  ws.onopen = () => {
    console.log('[Figma Bridge] Connected to proxy')
    // Request file info from main thread
    parent.postMessage({ pluginMessage: { type: 'get-file-info' } }, '*')
    updateStatus(true)
  }

  ws.onclose = () => {
    updateStatus(false)
    setTimeout(connect, 2000)
  }

  ws.onerror = () => {
    ws?.close()
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data) as { id: string; command: string; args?: unknown }
    parent.postMessage({ pluginMessage: { type: 'command', ...data } }, '*')
  }
}

window.onmessage = (event) => {
  const msg = event.data.pluginMessage as {
    type: string
    id?: string
    result?: unknown
    error?: string
    sessionId?: string
    fileName?: string
  }

  if (msg.type === 'file-info' && ws) {
    currentSessionId = msg.sessionId || null
    currentFileName = msg.fileName || null
    // Register this plugin instance with proxy
    ws.send(
      JSON.stringify({
        type: 'register',
        sessionId: currentSessionId,
        fileName: currentFileName
      })
    )
    console.log('[Figma Bridge] Registered file:', currentFileName, currentSessionId)
    return
  }

  if (msg.type !== 'result' || !ws) return
  ws.send(JSON.stringify({ id: msg.id, result: msg.result, error: msg.error }))
}

function updateStatus(connected: boolean) {
  if (statusEl) {
    statusEl.textContent = connected ? '✓ Connected' : '○ Connecting...'
    statusEl.style.color = connected ? '#0a0' : '#999'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  statusEl = document.getElementById('status')
  connect()
})
