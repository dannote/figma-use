import { initCodec, encodeMessage } from '../packages/cli/src/multiplayer/codec.ts'

await initCodec()

// What we send
const nodeChange = {
  guid: { sessionID: 123, localID: 456 },
  phase: 'CREATED',
  parentIndex: {
    guid: { sessionID: 123, localID: 1 },
    position: 'a',
  },
  type: 'TEXT',
  name: 'test-text',
  textData: { characters: 'Hello' },
  textAutoResize: 'WIDTH_AND_HEIGHT',
  fontSize: 16,
  lineHeight: { value: 0, units: 'RAW' },
  fontName: {
    family: 'Inter',
    style: 'Regular',
    postscript: 'Inter-Regular',
  },
  fillPaints: [{
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
  }],
}

const message = {
  type: 'NODE_CHANGES',
  sessionID: 123,
  ackID: 1,
  nodeChanges: [nodeChange],
}

const encoded = encodeMessage(message)

// Decompress to see raw kiwi
import { decompress } from '../packages/cli/src/multiplayer/codec.ts'
import { isZstdCompressed } from '../packages/cli/src/multiplayer/protocol.ts'

let bytes = new Uint8Array(encoded)
if (isZstdCompressed(bytes)) {
  bytes = decompress(bytes)
}

console.log('Our message length:', bytes.length)
console.log('Our message hex:')
console.log(Buffer.from(bytes).toString('hex'))

// Find key fields
const buf = Buffer.from(bytes)
console.log('\n--- Field analysis ---')

// type field
const typeIdx = buf.indexOf(Buffer.from([0x04, 0x0d]))
console.log('type=TEXT at:', typeIdx)

// textAutoResize field (46 = 0x2e)
for (let i = 0; i < buf.length - 1; i++) {
  if (buf[i] === 0x2e) {
    console.log(`Field 46 (textAutoResize) at ${i}: value=${buf[i+1]}`)
  }
}

// fontName field (41 = 0x29)
const fontIdx = buf.indexOf(Buffer.from([0x29]))
if (fontIdx >= 0) {
  console.log('fontName field at:', fontIdx, '- context:', buf.slice(fontIdx, fontIdx + 30).toString('hex'))
}

// textData field (53)
const textDataField = buf.indexOf(Buffer.from([0x35])) // 53 = 0x35
console.log('textData field at:', textDataField)

// fontSize field (39 = 0x27)
const fontSizeIdx = buf.indexOf(Buffer.from([0x27]))
console.log('fontSize field at:', fontSizeIdx)
