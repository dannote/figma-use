const PROXY_URL = 'ws://localhost:38451/plugin'

console.log('[Figma Bridge] UI loaded')

let ws: WebSocket | null = null
let statusEl: HTMLElement | null = null

function connect() {
  ws = new WebSocket(PROXY_URL)

  ws.onopen = () => {
    console.log('[Figma Bridge] Connected to proxy')
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
  const msg = event.data.pluginMessage as { type: string; id: string; result?: unknown; error?: string }
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
