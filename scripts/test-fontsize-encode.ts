import { initCodec, encodeMessage } from '../packages/cli/src/multiplayer/codec.ts'
import { decompress } from '../packages/cli/src/multiplayer/codec.ts'
import { isZstdCompressed } from '../packages/cli/src/multiplayer/protocol.ts'

await initCodec()

// Minimal TEXT node with fontSize
const nodeChange = {
  guid: { sessionID: 1, localID: 1 },
  phase: 'CREATED',
  type: 'TEXT',
  name: 'x',
  fontSize: 16,
}

const message = {
  type: 'NODE_CHANGES',
  sessionID: 1,
  ackID: 1,
  nodeChanges: [nodeChange],
}

const encoded = encodeMessage(message)
let bytes = new Uint8Array(encoded)
if (isZstdCompressed(bytes)) {
  bytes = decompress(bytes)
}

console.log('Hex:', Buffer.from(bytes).toString('hex'))
console.log('Length:', bytes.length)

// Search for field 21 (fontSize) = 0x15
const buf = Buffer.from(bytes)
for (let i = 0; i < buf.length - 1; i++) {
  if (buf[i] === 0x15) {
    console.log(`Field 21 at offset ${i}: next bytes = ${buf.slice(i, i+5).toString('hex')}`)
  }
}

// Also check if fontSize=16 appears somewhere
// 16 in float = 0x41800000
// In kiwi rotated: (0x41800000 << 23) | (0x41800000 >>> 9) 
const float16 = Buffer.alloc(4)
float16.writeFloatLE(16)
console.log('\nfloat 16 raw bytes:', float16.toString('hex'))

const bits = float16.readUInt32LE(0)
const rotated = ((bits << 23) | (bits >>> 9)) >>> 0
console.log('Kiwi rotated:', rotated.toString(16))
