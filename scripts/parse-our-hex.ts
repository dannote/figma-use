// Parse our hex more carefully

const hex = '040d0548656c6c6f001583000000210026010100020000007f000000037f00000004010028000029496e74657200526567756c617200496e7465722d526567756c6172002a0148656c6c6f00002e0100'

const buf = Buffer.from(hex, 'hex')

let i = 0
console.log('Parsing our NodeChange encoding:\n')

// type
console.log(`[${i}] Field ${buf[i]} = type`)
i++
console.log(`[${i}] Value ${buf[i]} = TEXT (13)`)
i++

// name  
console.log(`[${i}] Field ${buf[i]} = name`)
i++
let name = ''
while (buf[i] !== 0) {
  name += String.fromCharCode(buf[i])
  i++
}
console.log(`    Value = "${name}"`)
i++ // null

// fontSize (field 21 = 0x15)
console.log(`[${i}] Field ${buf[i]} (0x${buf[i].toString(16)}) = fontSize (21)`)
i++
console.log(`    Raw: ${buf.slice(i, i+4).toString('hex')}`)
i += 4

// next field
console.log(`[${i}] Field ${buf[i]} (0x${buf[i].toString(16)}) = textAlignVertical? (33=0x21)`)
i++
console.log(`    Value: ${buf[i]}`)
i++

// next
console.log(`[${i}] Field ${buf[i]} (0x${buf[i].toString(16)})`)
i++

// Continue parsing
while (i < buf.length && i < 80) {
  console.log(`[${i}] 0x${buf[i].toString(16)} = ${buf[i]}`)
  i++
}
