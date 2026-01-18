/**
 * Compare our TEXT encoding vs what works
 * 
 * Strategy: 
 * 1. Create TEXT via plugin (works correctly)
 * 2. Modify it slightly to capture what Figma sends
 * 3. Compare with what we send
 */
import { initCodec, encodeMessage, decompress } from '../packages/cli/src/multiplayer/codec.ts'
import { isZstdCompressed } from '../packages/cli/src/multiplayer/protocol.ts'

await initCodec()

// What WE send for TEXT node
const ourNodeChange = {
  guid: { sessionID: 221036, localID: 999999 },
  phase: 'CREATED',
  parentIndex: {
    guid: { sessionID: 221036, localID: 908 },
    position: 'a',
  },
  type: 'TEXT',
  name: 'Hello',
  textData: { characters: 'Hello' },
  textAutoResize: 'WIDTH_AND_HEIGHT',
  textAlignVertical: 'TOP',
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

const ourMessage = {
  type: 'NODE_CHANGES',
  sessionID: 221036,
  ackID: 1,
  nodeChanges: [ourNodeChange],
}

const encoded = encodeMessage(ourMessage)
let bytes = new Uint8Array(encoded)
if (isZstdCompressed(bytes)) {
  bytes = decompress(bytes)
}

const buf = Buffer.from(bytes)
console.log('=== OUR ENCODING ===')
console.log('Total length:', buf.length)
console.log('Full hex:', buf.toString('hex'))

// Find TEXT type marker
const textIdx = buf.indexOf(Buffer.from([0x04, 0x0d]))
console.log('\nTEXT type at offset:', textIdx)

// Parse fields starting from there
console.log('\n--- Fields after TEXT type ---')
let i = textIdx + 2 // skip 04 0d
while (i < buf.length && i < textIdx + 100) {
  const field = buf[i]
  if (field === 0) {
    console.log(`[${i}] END`)
    break
  }
  
  // Known fields for NodeChange
  const fieldNames: Record<number, string> = {
    5: 'name',
    15: 'size',
    21: 'fontSize',
    26: 'visible',
    33: 'textAlignVertical',
    39: 'textAlignHorizontal',
    40: 'lineHeight',
    41: 'fontName',
    42: 'textData',
    46: 'textAutoResize',
  }
  
  const name = fieldNames[field] || `field_${field}`
  console.log(`[${i}] ${field} (0x${field.toString(16)}) = ${name}`)
  i++
}

// Now let's look at what Figma captured earlier
console.log('\n\n=== FIGMA CAPTURE (from earlier sniff) ===')
// This was from the earlier capture when you typed 't'
const figmaHex = '040d055465787400158200008021002885000090022949'
console.log('Partial hex:', figmaHex)

const figmaBuf = Buffer.from(figmaHex, 'hex')
console.log('\n--- Figma fields ---')
let j = 2 // skip 04 0d
while (j < figmaBuf.length) {
  const field = figmaBuf[j]
  if (field === 0) {
    console.log(`[${j}] END/null`)
    j++
    continue
  }
  
  const fieldNames: Record<number, string> = {
    5: 'name',
    15: 'size', 
    21: 'fontSize',
    26: 'visible',
    33: 'textAlignVertical',
    39: 'textAlignHorizontal', 
    40: 'lineHeight',
    41: 'fontName',
    42: 'textData',
    46: 'textAutoResize',
  }
  
  const name = fieldNames[field] || `field_${field}`
  console.log(`[${j}] ${field} (0x${field.toString(16)}) = ${name}`)
  j++
}
