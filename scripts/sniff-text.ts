/**
 * Capture TEXT node creation from Figma
 */
import { initCodec, decodeMessage, decompress } from '../packages/cli/src/multiplayer/codec.ts'
import { isZstdCompressed, hasFigWireHeader, skipFigWireHeader, isKiwiMessage, getKiwiMessageType } from '../packages/cli/src/multiplayer/protocol.ts'

const DEVTOOLS_URL = 'http://localhost:9222/json'

interface Target {
  webSocketDebuggerUrl: string
  title: string
  url: string
}

await initCodec()

const targets = await fetch(DEVTOOLS_URL).then(r => r.json()) as Target[]
const figmaTarget = targets.find(t => t.url.includes('/design/') || t.url.includes('/file/'))

if (!figmaTarget) {
  console.error('No Figma tab found')
  process.exit(1)
}

console.log(`Connecting to: ${figmaTarget.title}\n`)

const ws = new WebSocket(figmaTarget.webSocketDebuggerUrl)

let msgId = 1
const send = (method: string, params?: object) => {
  ws.send(JSON.stringify({ id: msgId++, method, params }))
}

ws.onopen = () => {
  send('Network.enable')
  console.log('🔍 Listening... Create a TEXT node in Figma (press T, click, type something)\n')
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data as string)
  
  if (msg.method === 'Network.webSocketFrameSent') {
    const payload = msg.params?.response?.payloadData
    if (!payload) return
    if (payload.startsWith('{') || payload.startsWith('[')) return
    
    let bytes = new Uint8Array(Buffer.from(payload, 'base64'))
    
    // Decompress if zstd
    if (isZstdCompressed(bytes)) {
      try {
        bytes = decompress(bytes)
      } catch {
        return
      }
    }
    
    // Skip FigWire header if present
    if (hasFigWireHeader(bytes)) {
      bytes = skipFigWireHeader(bytes)
    }
    
    if (!isKiwiMessage(bytes)) return
    
    const msgType = getKiwiMessageType(bytes)
    if (msgType !== 1) return // Only NODE_CHANGES
    
    // Try to decode
    try {
      const decoded = decodeMessage(bytes)
      if (!decoded?.nodeChanges?.length) return
      
      for (const nc of decoded.nodeChanges) {
        if (nc.type === 'TEXT' || nc.textData) {
          console.log('=== TEXT NODE FOUND ===')
          console.log('Full hex:', Buffer.from(bytes).toString('hex'))
          console.log('\nDecoded nodeChange:')
          console.log(JSON.stringify(nc, null, 2))
          console.log('\n')
        }
      }
    } catch {
      // Decode failed, just show hex if it might be text-related
      const str = Buffer.from(bytes).toString('utf8')
      if (str.includes('TEXT') || str.includes('text') || str.includes('Hello')) {
        console.log('=== POSSIBLY TEXT (decode failed) ===')
        console.log('Hex:', Buffer.from(bytes).toString('hex'))
        console.log('\n')
      }
    }
  }
}

// Keep running
await new Promise(() => {})
