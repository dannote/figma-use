/**
 * Capture full TEXT node data from Figma
 */
import { initCodec, decompress } from '../packages/cli/src/multiplayer/codec.ts'
import { isZstdCompressed, hasFigWireHeader, skipFigWireHeader, isKiwiMessage, getKiwiMessageType } from '../packages/cli/src/multiplayer/protocol.ts'

const DEVTOOLS_URL = 'http://localhost:9222/json'

await initCodec()

const targets = await fetch(DEVTOOLS_URL).then(r => r.json())
const figmaTarget = targets.find((t: any) => t.url.includes('/design/') || t.url.includes('/file/'))

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
  console.log('🔍 Listening... Create a TEXT node in Figma\n')
}

let captured = false
ws.onmessage = (event) => {
  if (captured) return
  
  const msg = JSON.parse(event.data as string)
  
  if (msg.method === 'Network.webSocketFrameSent') {
    const payload = msg.params?.response?.payloadData
    if (!payload || payload.startsWith('{') || payload.startsWith('[')) return
    
    let bytes = new Uint8Array(Buffer.from(payload, 'base64'))
    
    if (isZstdCompressed(bytes)) {
      try { bytes = decompress(bytes) } catch { return }
    }
    
    if (hasFigWireHeader(bytes)) bytes = skipFigWireHeader(bytes)
    if (!isKiwiMessage(bytes)) return
    
    const msgType = getKiwiMessageType(bytes)
    if (msgType !== 1) return
    
    // Look for TEXT type (0x04 0x0d) in the message
    const buf = Buffer.from(bytes)
    const textTypeIdx = buf.indexOf(Buffer.from([0x04, 0x0d]))
    if (textTypeIdx < 0) return
    
    captured = true
    console.log('=== TEXT NODE FOUND ===')
    console.log('Full decompressed hex:')
    console.log(buf.toString('hex'))
    console.log('\n--- Parsing fields around TEXT ---')
    
    // Find and decode each field
    let i = textTypeIdx
    while (i < buf.length - 1 && i < textTypeIdx + 150) {
      const fieldNum = buf[i]
      if (fieldNum === 0) {
        console.log(`  [${i}] END marker`)
        break
      }
      
      console.log(`  [${i}] Field ${fieldNum} (0x${fieldNum.toString(16)})`)
      i++
      
      // Try to interpret value based on field number
      if (fieldNum === 5) { // name - string
        let str = ''
        while (buf[i] !== 0 && i < buf.length) {
          str += String.fromCharCode(buf[i])
          i++
        }
        console.log(`       name = "${str}"`)
        i++ // skip null terminator
      } else if (fieldNum === 21 || fieldNum === 40) { // fontSize, lineHeight - float
        const floatBytes = buf.slice(i, i + 4)
        console.log(`       raw bytes: ${floatBytes.toString('hex')}`)
        i += 4
      } else if (fieldNum === 41) { // fontName - struct
        console.log(`       fontName struct starts here`)
        // Read family string
        let family = ''
        while (buf[i] !== 0 && i < buf.length) {
          family += String.fromCharCode(buf[i])
          i++
        }
        i++ // null
        let style = ''
        while (buf[i] !== 0 && i < buf.length) {
          style += String.fromCharCode(buf[i])
          i++
        }
        i++ // null
        console.log(`       family = "${family}", style = "${style}"`)
      } else {
        // Skip to next field (heuristic)
        i++
      }
    }
    
    process.exit(0)
  }
}

setTimeout(() => {
  console.log('Timeout - no TEXT created')
  process.exit(1)
}, 30000)
