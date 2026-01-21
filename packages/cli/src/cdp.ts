import WebSocket from 'ws'

interface CDPTarget {
  webSocketDebuggerUrl: string
  url: string
  type: string
}

let cachedWs: WebSocket | null = null
let cachedTarget: CDPTarget | null = null
let messageId = 0

async function getCDPTarget(): Promise<CDPTarget> {
  if (cachedTarget) return cachedTarget

  const resp = await fetch('http://localhost:9222/json')
  const targets = (await resp.json()) as CDPTarget[]

  // Prefer design files over FigJam boards
  const figmaTarget =
    targets.find(
      (t) =>
        t.type === 'page' &&
        (t.url.includes('figma.com/design') || t.url.includes('figma.com/file'))
    ) ||
    targets.find(
      (t) => t.type === 'page' && t.url.includes('figma.com/board') // FigJam fallback
    )

  if (!figmaTarget) {
    throw new Error(
      'No Figma file open in browser.\n' +
        'Start Figma with: open -a Figma --args --remote-debugging-port=9222'
    )
  }

  cachedTarget = figmaTarget
  return figmaTarget
}

async function getWebSocket(): Promise<WebSocket> {
  if (cachedWs?.readyState === WebSocket.OPEN) return cachedWs

  const target = await getCDPTarget()

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    ws.on('open', () => {
      cachedWs = ws
      resolve(ws)
    })
    ws.on('error', reject)
  })
}

export async function cdpEval<T>(code: string, timeout = 30000): Promise<T> {
  const ws = await getWebSocket()
  const id = ++messageId

  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', handler)
        reject(new Error('CDP timeout'))
      }, timeout)

      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString())
        if (msg.id === id) {
          clearTimeout(timer)
          ws.off('message', handler)

          if (msg.result?.exceptionDetails) {
            const err = msg.result.exceptionDetails
            reject(new Error(err.exception?.description || err.text || 'CDP error'))
          } else {
            resolve(msg.result?.result?.value as T)
          }
        }
      }

      ws.on('message', handler)

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
  } finally {
    // Close after each request to allow process exit
    closeCDP()
  }
}

export function getFileKeyFromUrl(url: string): string {
  const match = url.match(/\/(file|design)\/([a-zA-Z0-9]+)/)
  if (!match?.[2]) throw new Error('Could not extract file key from URL')
  return match[2]
}

export async function getFileKey(): Promise<string> {
  const target = await getCDPTarget()
  return getFileKeyFromUrl(target.url)
}

export function closeCDP(): void {
  if (cachedWs) {
    cachedWs.close()
    cachedWs = null
  }
  cachedTarget = null
}
