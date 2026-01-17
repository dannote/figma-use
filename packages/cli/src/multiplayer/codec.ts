/**
 * Message Encoding/Decoding for Figma Multiplayer
 * 
 * Uses:
 * - kiwi-schema: Binary serialization (by Evan Wallace, Figma co-founder)
 * - Bun.zstd*: Native Zstd compression (built into Bun)
 */

import { compileSchema, type Schema } from 'kiwi-schema'
import { isZstdCompressed, isKiwiMessage, getKiwiMessageType } from './protocol.ts'
import figmaSchema from './schema.ts'

interface CompiledSchema {
  encodeMessage(message: unknown): Uint8Array
  decodeMessage(data: Uint8Array): unknown
}

let compiledSchema: CompiledSchema | null = null

/**
 * Initialize the codec (compiles Kiwi schema)
 */
export async function initCodec(): Promise<void> {
  if (compiledSchema) return
  compiledSchema = compileSchema(figmaSchema as Schema) as CompiledSchema
}

/**
 * Check if codec is initialized
 */
export function isCodecReady(): boolean {
  return compiledSchema !== null
}

/**
 * Compress data using Zstd (Bun native)
 */
export function compress(data: Uint8Array): Uint8Array {
  return Bun.zstdCompressSync(data)
}

/**
 * Decompress Zstd data (Bun native)
 */
export function decompress(data: Uint8Array): Uint8Array {
  if (!isZstdCompressed(data)) return data
  return Bun.zstdDecompressSync(data)
}

/**
 * Encode a message for sending to Figma
 */
export function encodeMessage(message: FigmaMessage): Uint8Array {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }
  
  const encoded = compiledSchema.encodeMessage(message)
  return compress(encoded)
}

/**
 * Decode a message received from Figma
 */
export function decodeMessage(data: Uint8Array): FigmaMessage {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }

  const decompressed = decompress(data)
  return compiledSchema.decodeMessage(decompressed) as FigmaMessage
}

/**
 * Quick peek at message type without full decoding
 */
export function peekMessageType(data: Uint8Array): number | null {
  try {
    const decompressed = decompress(data)
    return getKiwiMessageType(decompressed)
  } catch {
    return null
  }
}

// Type definitions

export interface GUID {
  sessionID: number
  localID: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface Vector {
  x: number
  y: number
}

export interface Matrix {
  m00: number
  m01: number
  m02: number
  m10: number
  m11: number
  m12: number
}

export interface ParentIndex {
  guid: GUID
  position: string
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: Color
  opacity?: number
  visible?: boolean
  blendMode?: string
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color?: Color
  offset?: Vector
  radius?: number
  visible?: boolean
  spread?: number
}

export interface NodeChange {
  guid: GUID
  phase?: 'CREATED' | 'REMOVED'
  parentIndex?: ParentIndex
  type?: string
  name?: string
  visible?: boolean
  locked?: boolean
  opacity?: number
  blendMode?: string
  size?: Vector
  transform?: Matrix
  cornerRadius?: number
  fillPaints?: Paint[]
  strokePaints?: Paint[]
  strokeWeight?: number
  strokeAlign?: string
  effects?: Effect[]
  // Layout
  stackMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  stackSpacing?: number
  stackPadding?: number
  stackPaddingRight?: number
  stackPaddingBottom?: number
  stackCounterAlign?: string
  stackJustify?: string
  stackCounterAlignItems?: string
  // Text
  fontSize?: number
  fontName?: { family: string; style: string }
  textAlignHorizontal?: string
  textAlignVertical?: string
  textAutoResize?: string
  // Corners
  rectangleTopLeftCornerRadius?: number
  rectangleTopRightCornerRadius?: number
  rectangleBottomLeftCornerRadius?: number
  rectangleBottomRightCornerRadius?: number
  rectangleCornerRadiiIndependent?: boolean
  cornerSmoothing?: number
  // Constraints
  horizontalConstraint?: string
  verticalConstraint?: string
}

export interface FigmaMessage {
  type: string
  sessionID?: number
  ackID?: number
  reconnectSequenceNumber?: number
  nodeChanges?: NodeChange[]
}

/**
 * Create a NODE_CHANGES message
 */
export function createNodeChangesMessage(
  sessionID: number,
  reconnectSequenceNumber: number,
  nodeChanges: NodeChange[],
  ackID = 1
): FigmaMessage {
  return {
    type: 'NODE_CHANGES',
    sessionID,
    ackID,
    reconnectSequenceNumber,
    nodeChanges,
  }
}

/**
 * Create a node change for a new shape
 */
export function createNodeChange(opts: {
  sessionID: number
  localID: number
  parentSessionID: number
  parentLocalID: number
  position?: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  fill?: Color | string
  stroke?: Color | string
  strokeWeight?: number
  cornerRadius?: number
  opacity?: number
}): NodeChange {
  const change: NodeChange = {
    guid: { sessionID: opts.sessionID, localID: opts.localID },
    phase: 'CREATED',
    parentIndex: {
      guid: { sessionID: opts.parentSessionID, localID: opts.parentLocalID },
      position: opts.position || '!',
    },
    type: opts.type,
    name: opts.name,
    visible: true,
    opacity: opts.opacity ?? 1.0,
    size: { x: opts.width, y: opts.height },
    transform: {
      m00: 1, m01: 0, m02: opts.x,
      m10: 0, m11: 1, m12: opts.y,
    },
  }

  if (opts.fill) {
    const color = typeof opts.fill === 'string' ? parseColor(opts.fill) : opts.fill
    change.fillPaints = [{
      type: 'SOLID',
      color,
      opacity: 1.0,
      visible: true,
      blendMode: 'NORMAL',
    }]
  }

  if (opts.stroke) {
    const color = typeof opts.stroke === 'string' ? parseColor(opts.stroke) : opts.stroke
    change.strokePaints = [{
      type: 'SOLID',
      color,
      opacity: 1.0,
      visible: true,
      blendMode: 'NORMAL',
    }]
    change.strokeWeight = opts.strokeWeight ?? 1
  }

  if (opts.cornerRadius !== undefined) {
    change.cornerRadius = opts.cornerRadius
  }

  return change
}

/**
 * Parse hex color to Color object
 */
function parseColor(hex: string): Color {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}
