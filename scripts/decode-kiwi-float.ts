// Decode Kiwi float encoding

function decodeKiwiFloat(bytes: number[]): number {
  // Read varint
  let value = 0
  let shift = 0
  for (const b of bytes) {
    value |= (b & 0x7f) << shift
    if (!(b & 0x80)) break
    shift += 7
  }
  
  // Kiwi float rotation: bits = (encoded >>> 23) | (encoded << 9)
  const bits = ((value >>> 23) | (value << 9)) >>> 0
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(bits)
  return buf.readFloatLE(0)
}

// Figma sends: 82 00 00 80 for fontSize
console.log('Figma fontSize (82 00 00 80):')
// This is a varint, need to parse it properly
// 82 = 0b10000010 -> has continuation, value = 2
// 00 = 0b00000000 -> no continuation, value = 0 at shift 7
// So total = 2 | (0 << 7) = 2
// But wait, there are more bytes...

// Actually 82 00 00 80:
// 82 has MSB set -> continue
// 00 no MSB -> stop? 
// Let me try different interpretation

// Maybe it's raw 4 bytes little-endian?
const figmaBuf = Buffer.from([0x82, 0x00, 0x00, 0x80])
const figmaUint = figmaBuf.readUInt32LE(0)
console.log('As uint32:', figmaUint, '(0x' + figmaUint.toString(16) + ')')

// Un-rotate
const figmaBits = ((figmaUint >>> 23) | (figmaUint << 9)) >>> 0
console.log('Un-rotated:', figmaBits.toString(16))
const figmaFloatBuf = Buffer.alloc(4)
figmaFloatBuf.writeUInt32LE(figmaBits)
console.log('As float:', figmaFloatBuf.readFloatLE(0))

console.log('\n---')

// Our encoding: 83 00 00 00 for fontSize 16
console.log('\nOur fontSize (83 00 00 00):')
const ourBuf = Buffer.from([0x83, 0x00, 0x00, 0x00])
const ourUint = ourBuf.readUInt32LE(0)
console.log('As uint32:', ourUint, '(0x' + ourUint.toString(16) + ')')

// Un-rotate
const ourBits = ((ourUint >>> 23) | (ourUint << 9)) >>> 0
console.log('Un-rotated:', ourBits.toString(16))
const ourFloatBuf = Buffer.alloc(4)
ourFloatBuf.writeUInt32LE(ourBits)
console.log('As float:', ourFloatBuf.readFloatLE(0))

// Let's encode 16.0 properly
console.log('\n--- Encoding 16.0 ---')
const f16Buf = Buffer.alloc(4)
f16Buf.writeFloatLE(16.0)
console.log('16.0 as bytes:', f16Buf.toString('hex'))
const f16Uint = f16Buf.readUInt32LE(0)
console.log('16.0 as uint32:', f16Uint.toString(16))

// Kiwi rotation
const rotated = ((f16Uint << 23) | (f16Uint >>> 9)) >>> 0
console.log('Rotated:', rotated.toString(16))
const rotBuf = Buffer.alloc(4)
rotBuf.writeUInt32LE(rotated)
console.log('Rotated bytes:', rotBuf.toString('hex'))
