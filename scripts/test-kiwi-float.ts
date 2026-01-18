import { compileSchema, ByteBuffer } from 'kiwi-schema'

// Test kiwi ByteBuffer float encoding directly
const bb = new ByteBuffer()
bb.writeVarFloat(16.0)
const bytes = bb.toUint8Array()
console.log('writeVarFloat(16.0):', Buffer.from(bytes).toString('hex'))

const bb2 = new ByteBuffer()
bb2.writeVarFloat(12.0)
console.log('writeVarFloat(12.0):', Buffer.from(bb2.toUint8Array()).toString('hex'))

// Decode to verify
const bb3 = new ByteBuffer(bytes)
console.log('Decoded:', bb3.readVarFloat())
