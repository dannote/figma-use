import { describe, test, expect } from 'bun:test'
import {
  MESSAGE_TYPES,
  NODE_TYPES,
  buildMultiplayerUrl,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
} from '../src/multiplayer/protocol.ts'
import {
  initCodec,
  isCodecReady,
  compress,
  decompress,
  encodeMessage,
  createNodeChange,
  createNodeChangesMessage,
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
      0x66, 0x69, 0x67, 0x2d, 0x77, 0x69, 0x72, 0x65, // "fig-wire"
      0x01, 0x00, 0x00, 0x00, // version
      0x28, 0xb5, 0x2f, 0xfd, // zstd data
    ])
    const withoutHeader = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd])
    
    expect(hasFigWireHeader(withHeader)).toBe(true)
    expect(hasFigWireHeader(withoutHeader)).toBe(false)
  })

  test('skipFigWireHeader removes 12-byte header', () => {
    const withHeader = new Uint8Array([
      0x66, 0x69, 0x67, 0x2d, 0x77, 0x69, 0x72, 0x65,
      0x01, 0x00, 0x00, 0x00,
      0x28, 0xb5, 0x2f, 0xfd, 0xAA, 0xBB,
    ])
    
    const result = skipFigWireHeader(withHeader)
    expect(result[0]).toBe(0x28)
    expect(result[1]).toBe(0xb5)
    expect(result.length).toBe(6)
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
      fill: '#FF0000',
    })

    expect(change.guid).toEqual({ sessionID: 12345, localID: 100 })
    expect(change.phase).toBe('CREATED')
    expect(change.parentIndex?.guid).toEqual({ sessionID: 5291, localID: 112873 })
    expect(change.parentIndex?.position).toBe('!')
    expect(change.type).toBe('RECTANGLE')
    expect(change.name).toBe('Test Rect')
    expect(change.size).toEqual({ x: 100, y: 50 })
    expect(change.transform).toEqual({
      m00: 1, m01: 0, m02: 10,
      m10: 0, m11: 1, m12: 20,
    })
    expect(change.fillPaints).toHaveLength(1)
    expect(change.fillPaints![0].type).toBe('SOLID')
    expect(change.fillPaints![0].color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
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
      fill: { r: 0.5, g: 0.25, b: 0.75, a: 0.8 },
    })

    expect(change.fillPaints![0].color).toEqual({ r: 0.5, g: 0.25, b: 0.75, a: 0.8 })
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
      strokeWeight: 2,
    })

    expect(change.strokePaints).toHaveLength(1)
    expect(change.strokePaints![0].color).toEqual({ r: 0, g: 0, b: 1, a: 1 })
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
      cornerRadius: 8,
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
      height: 10,
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
        x: 0, y: 0, width: 10, height: 10,
      }),
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
        x: 0, y: 0, width: 100, height: 100,
      }),
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
