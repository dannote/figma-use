import { ByteBuffer } from 'kiwi-schema'

// Figma lineHeight bytes: 85 00 00 90 02
// First is float value, then enum

// 85 00 00 90 as kiwi varint float
const bb = new ByteBuffer(new Uint8Array([0x85, 0x00, 0x00, 0x90]))
// Actually it might be 4 bytes: 85 00 00 90, then 02 is units

// Try decoding
const bytes = [0x85, 0x00, 0x00, 0x90]
let varint = 0
let shift = 0
for (const b of bytes) {
  varint |= (b & 0x7f) << shift
  if (!(b & 0x80)) break
  shift += 7
}
console.log('Varint value:', varint)

// Actually let's check what kiwi decodes
const bb2 = new ByteBuffer(new Uint8Array([0x85, 0x00, 0x00, 0x90]))
try {
  const val = bb2.readVarFloat()
  console.log('readVarFloat:', val)
} catch (e) {
  console.log('readVarFloat failed:', e)
}

// What if units is embedded differently?
// 85 00 00 90 02
// Maybe: 85 is varfloat (5 bytes?), 02 is units

// Let's encode lineHeight AUTO (which is { value: 0, units: 0 })
const bb3 = new ByteBuffer()
bb3.writeVarFloat(0)
bb3.writeVarUint(0) // RAW
console.log('\nOur lineHeight (0, RAW):', Buffer.from(bb3.toUint8Array()).toString('hex'))

// What about { value: 1.2, units: PERCENT }?
const bb4 = new ByteBuffer()
bb4.writeVarFloat(1.2)
bb4.writeVarUint(2) // PERCENT
console.log('lineHeight (1.2, PERCENT):', Buffer.from(bb4.toUint8Array()).toString('hex'))

// Actually for auto lineHeight, Figma might use a special value
// Let me check what 85 00 00 90 decodes to
const bb5 = new ByteBuffer()
bb5.writeVarFloat(12) // common line height value
bb5.writeVarUint(2) // PERCENT
console.log('lineHeight (12, PERCENT):', Buffer.from(bb5.toUint8Array()).toString('hex'))

// Maybe Figma sends lineHeight as multiplier? Like 1.2 * 100 = 120%?
// Or just the pixel value like 19.2 for fontSize 16?
const bb6 = new ByteBuffer()
bb6.writeVarFloat(19.2)
console.log('float 19.2:', Buffer.from(bb6.toUint8Array()).toString('hex'))
