// Analyze Figma TEXT node creation more carefully

// Context around "Text" name:
// ecbe0d8c072200 04 0d 05 54657874 00 15 82000080 21 00 28 85000090 02 29 496e746572...

// Breakdown:
// 04 0d = type: TEXT (13)
// 05 54657874 00 = name: "Text"
// 15 82000080 = field 21 (fontSize)... value is 82000080 which is weird

// Let's decode 82000080 as varint
const bytes = [0x82, 0x00, 0x00, 0x80]
let value = 0
let shift = 0
for (const b of bytes) {
  value |= (b & 0x7f) << shift
  shift += 7
  if (!(b & 0x80)) break
}
console.log('fontSize raw varint:', value)

// Actually for float, it's different encoding
// Let's check field 21 in kiwi float encoding
// 82 00 00 80 in little-endian float
const buf = Buffer.from([0x82, 0x00, 0x00, 0x80])
console.log('As float32:', buf.readFloatLE(0))

// Maybe it's varint encoded float?
// In kiwi, floats use special encoding
// value 82 00 00 80 
// first byte 82 = 0x82 = 130
// if MSB set, continue...

// Let's look at field 28 (0x28 = 40 = lineHeight)
console.log('\nField 28 (lineHeight):')
// 28 85000090 02
// 85 00 00 90 02
const lhBuf = Buffer.from([0x85, 0x00, 0x00, 0x90])
console.log('lineHeight raw:', lhBuf.readFloatLE(0))

// Actually kiwi uses zigzag varint for floats!
// The bit rotation encoding: (bits << 23) | (bits >>> 9)

function decodeKiwiFloat(varint: number): number {
  const bits = ((varint >>> 23) | (varint << 9)) >>> 0
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(bits)
  return buf.readFloatLE(0)
}

// 82 as single byte varint = 2 (after removing MSB continuation)
// Actually 82 00 00 80 is multiple bytes...

// Let's just look at what fields Figma sends vs what we send
console.log('\n=== Fields in Figma message ===')
const figmaHex = '040d055465787400158200008021002885000090022949'
const figmaBytes = Buffer.from(figmaHex, 'hex')
for (let i = 0; i < figmaBytes.length; i++) {
  const b = figmaBytes[i]
  if (b < 50) { // likely a field number
    console.log(`Offset ${i}: field ${b} (0x${b.toString(16)})`)
  }
}
