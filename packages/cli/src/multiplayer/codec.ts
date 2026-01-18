/**
 * Message Encoding/Decoding for Figma Multiplayer
 * 
 * Uses:
 * - kiwi-schema: Binary serialization (by Evan Wallace, Figma co-founder)
 * - Bun.zstd*: Native Zstd compression (built into Bun)
 */

import { compileSchema, type Schema } from 'kiwi-schema'
import { isZstdCompressed, isKiwiMessage, getKiwiMessageType } from './protocol.ts'
import { parseColor } from '../color.ts'
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
 * Handles variable bindings in fillPaints which require custom encoding
 */
export function encodeMessage(message: FigmaMessage): Uint8Array {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }
  
  // Check if any nodeChange has variable bindings (fill or stroke)
  const hasVariables = message.nodeChanges?.some(nc => 
    nc.fillPaints?.some(p => p.colorVariableBinding) ||
    nc.strokePaints?.some(p => p.colorVariableBinding)
  )
  
  if (!hasVariables) {
    // Standard encoding
    const encoded = compiledSchema.encodeMessage(message)
    return compress(encoded)
  }
  
  // Need custom encoding for variable bindings
  // Strategy: encode each nodeChange separately, then combine
  const messageWithoutNodes = { ...message, nodeChanges: [] }
  const baseEncoded = compiledSchema.encodeMessage(messageWithoutNodes)
  const baseHex = Buffer.from(baseEncoded).toString('hex')
  
  // Encode nodeChanges with variable support
  const nodeChangeBytes: Uint8Array[] = []
  for (const nc of message.nodeChanges || []) {
    const encoded = encodeNodeChangeWithVariables(nc)
    nodeChangeBytes.push(encoded)
  }
  
  // Combine: base message + nodeChanges
  // Message structure: type, sessionID, ackID, reconnectSeqNum, nodeChanges[]
  // nodeChanges is field 5
  
  // Message structure in kiwi:
  // - Field 1 (type): enum MessageType
  // - Field 2 (sessionID): uint
  // - Field 3 (ackID): uint  
  // - Field 4 (nodeChanges): NodeChange[] - this is what we need to replace
  // - Field 25 (reconnectSequenceNumber): uint
  //
  // Empty array: "04 00" (field 4, length 0)
  // We need to replace "04 00" with "04 <count> <nodes>"
  
  const emptyArrayPattern = '0400' // field 4, length 0
  const emptyArrayIdx = baseHex.indexOf(emptyArrayPattern)
  
  if (emptyArrayIdx === -1) {
    // Fallback to standard encoding
    const encoded = compiledSchema.encodeMessage(message)
    return compress(encoded)
  }
  
  // Build nodeChanges array with our encoded nodes
  const ncBytes: number[] = [0x04] // field 4
  ncBytes.push(...encodeVarint(nodeChangeBytes.length)) // array length
  for (const ncArr of nodeChangeBytes) {
    ncBytes.push(...Array.from(ncArr))
  }
  
  // Replace "0400" with our nodeChanges
  const beforeArray = baseHex.slice(0, emptyArrayIdx)
  const afterArray = baseHex.slice(emptyArrayIdx + 4) // skip "0400"
  
  const ncHex = Buffer.from(ncBytes).toString('hex')
  const finalHex = beforeArray + ncHex + afterArray
  
  const finalBytes = new Uint8Array(finalHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return compress(finalBytes)
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

export interface VariableBinding {
  variableID: GUID
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE'
  color?: Color
  opacity?: number
  visible?: boolean
  blendMode?: string
  colorVariableBinding?: VariableBinding // Binds color to a Figma variable
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
 * Encode a varint (variable-length integer)
 */
function encodeVarint(value: number): number[] {
  const bytes: number[] = []
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80)
    value >>>= 7
  }
  bytes.push(value)
  return bytes
}

/**
 * Encode a Paint with optional variable binding
 * 
 * Figma's variable binding format (discovered via WS traffic analysis):
 * - Field 21 = 1 (binding type)
 * - Field 4 = 1 (flag)
 * - Raw sessionID varint (no field number)
 * - Raw localID varint (no field number)
 * - Terminators: 00 00 02 03 03 04 00 00
 */
export function encodePaintWithVariableBinding(
  paint: Paint,
  variableSessionID: number,
  variableLocalID: number
): Uint8Array {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }
  
  // Encode base paint without variable binding
  const basePaint = { ...paint }
  delete (basePaint as any).colorVariableBinding
  
  const baseBytes = (compiledSchema as any).encodePaint(basePaint)
  const baseArray = Array.from(baseBytes) as number[]
  
  // Remove trailing 00
  if (baseArray[baseArray.length - 1] === 0) {
    baseArray.pop()
  }
  
  // Add variable binding in Figma's exact format:
  // Field 21 (0x15) = 1 (binding type)
  baseArray.push(0x15, 0x01)
  // Field 4 = 1 (flag)  
  baseArray.push(0x04, 0x01)
  // Raw varints: sessionID, localID (no field numbers!)
  baseArray.push(...encodeVarint(variableSessionID))
  baseArray.push(...encodeVarint(variableLocalID))
  // Terminators observed in Figma traffic
  baseArray.push(0x00, 0x00, 0x02, 0x03, 0x03, 0x04)
  // Final terminators
  baseArray.push(0x00, 0x00)
  
  return new Uint8Array(baseArray)
}

/**
 * Parse a variable ID string (e.g., "VariableID:38448:122296")
 * Returns sessionID and localID
 */
export function parseVariableId(variableId: string): { sessionID: number; localID: number } | null {
  const match = variableId.match(/VariableID:(\d+):(\d+)/)
  if (!match) return null
  return {
    sessionID: parseInt(match[1], 10),
    localID: parseInt(match[2], 10)
  }
}

/**
 * Encode a NodeChange with variable bindings in fillPaints and/or strokePaints
 * This is needed because kiwi-schema cannot produce Figma's exact variable binding format
 */
export function encodeNodeChangeWithVariables(nodeChange: NodeChange): Uint8Array {
  if (!compiledSchema) {
    throw new Error('Codec not initialized. Call initCodec() first.')
  }
  
  const hasFillBinding = nodeChange.fillPaints?.some(p => p.colorVariableBinding)
  const hasStrokeBinding = nodeChange.strokePaints?.some(p => p.colorVariableBinding)
  
  if (!hasFillBinding && !hasStrokeBinding) {
    return (compiledSchema as any).encodeNodeChange(nodeChange)
  }
  
  // Create a copy without variable bindings for base encoding
  const cleanNodeChange = { ...nodeChange }
  if (cleanNodeChange.fillPaints) {
    cleanNodeChange.fillPaints = cleanNodeChange.fillPaints.map(p => {
      const clean = { ...p }
      delete (clean as any).colorVariableBinding
      return clean
    })
  }
  if (cleanNodeChange.strokePaints) {
    cleanNodeChange.strokePaints = cleanNodeChange.strokePaints.map(p => {
      const clean = { ...p }
      delete (clean as any).colorVariableBinding
      return clean
    })
  }
  
  // Encode clean version
  const baseBytes = (compiledSchema as any).encodeNodeChange(cleanNodeChange)
  let hex = Buffer.from(baseBytes).toString('hex')
  
  // Inject fill variable binding (field 38 = 0x26)
  if (hasFillBinding && nodeChange.fillPaints?.[0]?.colorVariableBinding) {
    hex = injectVariableBinding(hex, '2601', nodeChange.fillPaints[0].colorVariableBinding)
  }
  
  // Inject stroke variable binding (field 39 = 0x27)
  if (hasStrokeBinding && nodeChange.strokePaints?.[0]?.colorVariableBinding) {
    hex = injectVariableBinding(hex, '2701', nodeChange.strokePaints[0].colorVariableBinding)
  }
  
  return new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
}

/**
 * Inject variable binding into a paint at the specified marker
 */
function injectVariableBinding(
  hex: string, 
  marker: string, 
  binding: { variableID: { sessionID: number; localID: number } }
): string {
  const markerIdx = hex.indexOf(marker)
  if (markerIdx === -1) return hex
  
  // Find visible=true pattern (04 01) after the marker
  const visiblePattern = '0401'
  let patternIdx = hex.indexOf(visiblePattern, markerIdx)
  if (patternIdx === -1) return hex
  
  // Move past 0401 to find where to insert
  let insertPoint = patternIdx + visiblePattern.length
  
  // Check if blendMode follows (05 01)
  if (hex.slice(insertPoint, insertPoint + 4) === '0501') {
    insertPoint += 4
  }
  
  // Build variable binding bytes
  const varBytes = [
    0x15, 0x01, // Field 21 (variableBinding) = 1
    0x04, 0x01, // Nested field 4 = 1
    ...encodeVarint(binding.variableID.sessionID),
    ...encodeVarint(binding.variableID.localID),
    0x00, 0x00, 0x02, 0x03, 0x03, 0x04, 0x00, 0x00 // Terminators
  ]
  const varHex = Buffer.from(varBytes).toString('hex')
  
  const beforeVar = hex.slice(0, insertPoint)
  // Skip original paint terminator (00) - our varHex includes terminators
  let afterIdx = insertPoint
  if (hex.slice(afterIdx, afterIdx + 2) === '00') {
    afterIdx += 2
  }
  const afterVar = hex.slice(afterIdx)
  
  return beforeVar + varHex + afterVar
}
