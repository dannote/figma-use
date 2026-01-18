import { initCodec, encodeMessage } from '../packages/cli/src/multiplayer/codec.ts'

await initCodec()

// Simulate what reconciler creates for TEXT node
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
console.log('Encoded length:', encoded.length)
console.log('Hex:', Buffer.from(encoded).toString('hex'))
