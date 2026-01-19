import { describe, test, expect } from 'bun:test'
import {
  MESSAGE_TYPES,
  NODE_TYPES,
  KIWI,
  SESSION_ID,
  buildMultiplayerUrl,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
  isKiwiMessage,
  getKiwiMessageType,
  parseVarint
} from '../src/multiplayer/protocol.ts'
import {
  initCodec,
  isCodecReady,
  compress,
  decompress,
  encodeMessage,
  createNodeChange,
  createNodeChangesMessage,
  encodePaintWithVariableBinding,
  type Paint
} from '../src/multiplayer/codec.ts'
import { parseFileKey } from '../src/multiplayer/client.ts'

describe('multiplayer/protocol', () => {
  test('MESSAGE_TYPES has required types', () => {
    expect(MESSAGE_TYPES.JOIN_START).toBe(0)
    expect(MESSAGE_TYPES.NODE_CHANGES).toBe(1)
    expect(MESSAGE_TYPES.USER_CHANGES).toBe(2)
    expect(MESSAGE_TYPES.JOIN_END).toBe(3)
    expect(MESSAGE_TYPES.SIGNAL).toBe(4)
  })

  test('NODE_TYPES has common types', () => {
    expect(NODE_TYPES.FRAME).toBe(4)
    expect(NODE_TYPES.RECTANGLE).toBe(10)
    expect(NODE_TYPES.TEXT).toBe(13)
    expect(NODE_TYPES.ELLIPSE).toBe(9)
  })

  test('buildMultiplayerUrl generates valid URL', () => {
    const url = buildMultiplayerUrl('abc123')
    expect(url).toContain('wss://www.figma.com/api/multiplayer/abc123')
    expect(url).toContain('role=editor')
    expect(url).toContain('version=')
  })

  test('isZstdCompressed detects zstd magic bytes', () => {
    const zstd = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x00])
    const notZstd = new Uint8Array([0x00, 0x01, 0x02, 0x03])

    expect(isZstdCompressed(zstd)).toBe(true)
    expect(isZstdCompressed(notZstd)).toBe(false)
    expect(isZstdCompressed(new Uint8Array([]))).toBe(false)
  })

  test('hasFigWireHeader detects fig-wire prefix', () => {
    const withHeader = new Uint8Array([
      0x66,
      0x69,
      0x67,
      0x2d,
      0x77,
      0x69,
      0x72,
      0x65, // "fig-wire"
      0x01,
      0x00,
      0x00,
      0x00, // version
      0x28,
      0xb5,
      0x2f,
      0xfd // zstd data
    ])
    const withoutHeader = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd])

    expect(hasFigWireHeader(withHeader)).toBe(true)
    expect(hasFigWireHeader(withoutHeader)).toBe(false)
  })

  test('skipFigWireHeader removes 12-byte header', () => {
    const withHeader = new Uint8Array([
      0x66, 0x69, 0x67, 0x2d, 0x77, 0x69, 0x72, 0x65, 0x01, 0x00, 0x00, 0x00, 0x28, 0xb5, 0x2f,
      0xfd, 0xaa, 0xbb
    ])

    const result = skipFigWireHeader(withHeader)
    expect(result[0]).toBe(0x28)
    expect(result[1]).toBe(0xb5)
    expect(result.length).toBe(6)
  })

  test('KIWI constants are defined', () => {
    expect(KIWI.MESSAGE_MARKER).toBe(1)
    expect(KIWI.SESSION_ID_FIELD).toBe(2)
    expect(KIWI.VARINT_CONTINUE_BIT).toBe(0x80)
    expect(KIWI.VARINT_VALUE_MASK).toBe(0x7f)
  })

  test('SESSION_ID range is defined', () => {
    expect(SESSION_ID.MIN).toBe(10000)
    expect(SESSION_ID.MAX).toBe(1000000)
  })

  test('isKiwiMessage detects valid messages', () => {
    expect(isKiwiMessage(new Uint8Array([1, 0]))).toBe(true)
    expect(isKiwiMessage(new Uint8Array([1, 5, 99]))).toBe(true)
    expect(isKiwiMessage(new Uint8Array([2, 0]))).toBe(false)
    expect(isKiwiMessage(new Uint8Array([0]))).toBe(false)
    expect(isKiwiMessage(new Uint8Array([]))).toBe(false)
  })

  test('getKiwiMessageType returns message type', () => {
    expect(getKiwiMessageType(new Uint8Array([1, 0]))).toBe(0)
    expect(getKiwiMessageType(new Uint8Array([1, 3]))).toBe(3)
    expect(getKiwiMessageType(new Uint8Array([1, 255]))).toBe(255)
    expect(getKiwiMessageType(new Uint8Array([2, 0]))).toBe(null)
  })

  test('parseVarint parses single-byte values', () => {
    // Value 0
    expect(parseVarint(new Uint8Array([0]), 0)).toEqual([0, 1])
    // Value 127 (max single byte)
    expect(parseVarint(new Uint8Array([127]), 0)).toEqual([127, 1])
    // Value 1
    expect(parseVarint(new Uint8Array([1]), 0)).toEqual([1, 1])
  })

  test('parseVarint parses multi-byte values', () => {
    // Value 128 = 0x80 0x01
    expect(parseVarint(new Uint8Array([0x80, 0x01]), 0)).toEqual([128, 2])
    // Value 300 = 0xAC 0x02
    expect(parseVarint(new Uint8Array([0xac, 0x02]), 0)).toEqual([300, 2])
    // Value 16384 = 0x80 0x80 0x01
    expect(parseVarint(new Uint8Array([0x80, 0x80, 0x01]), 0)).toEqual([16384, 3])
  })

  test('parseVarint respects offset', () => {
    const data = new Uint8Array([0xff, 0xff, 0x80, 0x01])
    expect(parseVarint(data, 2)).toEqual([128, 4])
  })
})

describe('multiplayer/codec', () => {
  test('initCodec initializes without error', async () => {
    await initCodec()
    expect(isCodecReady()).toBe(true)
  })

  test('compress/decompress roundtrip', async () => {
    await initCodec()

    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const compressed = compress(original)
    const decompressed = decompress(compressed)

    expect(isZstdCompressed(compressed)).toBe(true)
    expect(Array.from(decompressed)).toEqual(Array.from(original))
  })

  test('decompress returns input if not zstd', async () => {
    await initCodec()

    const notZstd = new Uint8Array([1, 2, 3, 4])
    const result = decompress(notZstd)

    expect(Array.from(result)).toEqual(Array.from(notZstd))
  })

  test('createNodeChange creates valid structure', () => {
    const change = createNodeChange({
      sessionID: 12345,
      localID: 100,
      parentSessionID: 5291,
      parentLocalID: 112873,
      type: 'RECTANGLE',
      name: 'Test Rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: '#FF0000'
    })

    expect(change.guid).toEqual({ sessionID: 12345, localID: 100 })
    expect(change.phase).toBe('CREATED')
    expect(change.parentIndex?.guid).toEqual({ sessionID: 5291, localID: 112873 })
    expect(change.parentIndex?.position).toBe('!')
    expect(change.type).toBe('RECTANGLE')
    expect(change.name).toBe('Test Rect')
    expect(change.size).toEqual({ x: 100, y: 50 })
    expect(change.transform).toEqual({
      m00: 1,
      m01: 0,
      m02: 10,
      m10: 0,
      m11: 1,
      m12: 20
    })
    expect(change.fillPaints).toHaveLength(1)
    expect(change.fillPaints?.[0]?.type).toBe('SOLID')
    expect(change.fillPaints?.[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test('createNodeChange with color object', () => {
    const change = createNodeChange({
      sessionID: 1,
      localID: 1,
      parentSessionID: 1,
      parentLocalID: 1,
      type: 'ELLIPSE',
      name: 'Circle',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      fill: { r: 0.5, g: 0.25, b: 0.75, a: 0.8 }
    })

    expect(change.fillPaints?.[0]?.color).toEqual({ r: 0.5, g: 0.25, b: 0.75, a: 0.8 })
  })

  test('createNodeChange with stroke', () => {
    const change = createNodeChange({
      sessionID: 1,
      localID: 1,
      parentSessionID: 1,
      parentLocalID: 1,
      type: 'FRAME',
      name: 'Frame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      stroke: '#0000FF',
      strokeWeight: 2
    })

    expect(change.strokePaints).toHaveLength(1)
    expect(change.strokePaints?.[0]?.color).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    expect(change.strokeWeight).toBe(2)
  })

  test('createNodeChange with cornerRadius', () => {
    const change = createNodeChange({
      sessionID: 1,
      localID: 1,
      parentSessionID: 1,
      parentLocalID: 1,
      type: 'RECTANGLE',
      name: 'Rounded',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 8
    })

    expect(change.cornerRadius).toBe(8)
  })

  test('createNodeChange with custom position', () => {
    const change = createNodeChange({
      sessionID: 1,
      localID: 1,
      parentSessionID: 1,
      parentLocalID: 1,
      position: '#',
      type: 'RECTANGLE',
      name: 'Positioned',
      x: 0,
      y: 0,
      width: 10,
      height: 10
    })

    expect(change.parentIndex?.position).toBe('#')
  })

  test('createNodeChangesMessage creates valid message', () => {
    const nodeChanges = [
      createNodeChange({
        sessionID: 12345,
        localID: 1,
        parentSessionID: 5291,
        parentLocalID: 112873,
        type: 'RECTANGLE',
        name: 'R1',
        x: 0,
        y: 0,
        width: 10,
        height: 10
      })
    ]

    const message = createNodeChangesMessage(12345, 4500, nodeChanges, 1)

    expect(message.type).toBe('NODE_CHANGES')
    expect(message.sessionID).toBe(12345)
    expect(message.ackID).toBe(1)
    expect(message.reconnectSequenceNumber).toBe(4500)
    expect(message.nodeChanges).toHaveLength(1)
  })

  test('encodeMessage produces zstd-compressed output', async () => {
    await initCodec()

    const message = createNodeChangesMessage(12345, 4500, [
      createNodeChange({
        sessionID: 12345,
        localID: 1,
        parentSessionID: 5291,
        parentLocalID: 112873,
        type: 'RECTANGLE',
        name: 'Test',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })
    ])

    const encoded = encodeMessage(message)

    expect(encoded).toBeInstanceOf(Uint8Array)
    expect(encoded.length).toBeGreaterThan(0)
    expect(isZstdCompressed(encoded)).toBe(true)
  })
})

describe('multiplayer/client', () => {
  test('parseFileKey extracts key from URL', () => {
    expect(parseFileKey('abc123')).toBe('abc123')
    expect(parseFileKey('https://www.figma.com/file/abc123/My-Design')).toBe('abc123')
    expect(parseFileKey('https://www.figma.com/design/xyz789/Test')).toBe('xyz789')
    expect(parseFileKey('https://figma.com/file/def456')).toBe('def456')
  })

  test('parseFileKey throws on invalid URL', () => {
    expect(() => parseFileKey('https://example.com/test')).toThrow('Invalid Figma URL')
  })
})

describe('variable binding encoding', () => {
  test('encodePaintWithVariableBinding produces correct format', async () => {
    await initCodec()

    const paint: Paint = {
      type: 'SOLID',
      color: { r: 0.972, g: 0.98, b: 0.988, a: 1 },
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL'
    }

    const encoded = encodePaintWithVariableBinding(paint, 38448, 122296)
    const hex = Buffer.from(encoded).toString('hex')

    // Should contain variable binding pattern
    expect(hex).toContain('15010401b0ac02b8bb07')
  })

  test('encodeMessage includes variable binding when present', async () => {
    await initCodec()

    const nodeChange = createNodeChange({
      sessionID: 1,
      localID: 1,
      parentSessionID: 1,
      parentLocalID: 1,
      type: 'RECTANGLE',
      name: 'Test',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: { r: 0.972, g: 0.98, b: 0.988, a: 1 }
    })

    nodeChange.fillPaints![0]!.colorVariableBinding = {
      variableID: { sessionID: 38448, localID: 122296 }
    }

    const message = createNodeChangesMessage(1, 0, [nodeChange])
    const encoded = encodeMessage(message)
    const decompressed = decompress(encoded)
    const hex = Buffer.from(decompressed).toString('hex')

    expect(hex).toContain('15010401b0ac02b8bb07')
  })
})
