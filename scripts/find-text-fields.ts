// Find TEXT node fields in captured Figma message

const hex = '010102ecbe0d03b8082680a7f8f7bc33040201ecbe0d8c07cb0202313438303932343533353532313237313530370003bc92b1cb0604ac89b1cb0600ed020201010101030102024e6f6465496e73657274696f6e4265686176696f722d4d4f5553455f4452414700030000010202526573697a6553656c656374696f6e4265686176696f722d4d4f5553455f44524147000300000104027570646174652d656469742d696e666f00030000000201cb0200000001ecbe0d9cd93a020003ecbe0d8c072200040d0554657874001582000080210028850000900229496e74657200526567756c617200002a01000c0101000a0002000900070008000000e70201860000a08600002c060101496e74657200526567756c61720000027f74d1350314d483e2c7f8032c6638d047167efbeba0030f0649040005a006000801097f010000007f01800101a5010002ca0100cb01058c03018402009702018703000601087f0000000b860000a08600002c0c7f0000000083010010007f000000870000051a7f0000001d021f0026010100027f0000007f0000007f0000007f000000037f00000004010501009c03010e011b002e00'

const bytes = Buffer.from(hex, 'hex')

// Find "Text" string
const textIdx = bytes.indexOf(Buffer.from('Text'))
console.log('"Text" found at offset:', textIdx)
console.log('Context around "Text":')
console.log(bytes.slice(Math.max(0, textIdx - 10), textIdx + 20).toString('hex'))

// Find "Inter" string  
const interIdx = bytes.indexOf(Buffer.from('Inter'))
console.log('\n"Inter" found at offset:', interIdx)
console.log('Context around "Inter":')
console.log(bytes.slice(Math.max(0, interIdx - 10), interIdx + 30).toString('hex'))

// Look for field patterns around TEXT type (0x04 0x0d = field 4, value TEXT=13)
console.log('\n\nSearching for type field (04 0d for TEXT):')
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0x04 && bytes[i+1] === 0x0d) {
    console.log(`Found at ${i}: ${bytes.slice(Math.max(0, i-5), i+20).toString('hex')}`)
  }
}

// Look for textAutoResize field (field 46 = 0x2e, value 1 = WIDTH_AND_HEIGHT)
console.log('\n\nSearching for textAutoResize (2e 01):')
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0x2e && bytes[i+1] === 0x01) {
    console.log(`Found at ${i}: ${bytes.slice(Math.max(0, i-5), i+10).toString('hex')}`)
  }
}

// Look for fontSize field (field 39 = 0x27)
console.log('\n\nSearching for fontSize (field 39 = 27):')
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0x27) {
    console.log(`Found at ${i}: ${bytes.slice(Math.max(0, i-3), i+8).toString('hex')}`)
  }
}
