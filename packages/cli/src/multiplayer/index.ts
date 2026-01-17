/**
 * Figma Multiplayer Module
 * 
 * Direct WebSocket access to Figma's multiplayer protocol.
 * Enables creating nodes 1000-5000x faster than the plugin API.
 * 
 * @example
 * ```ts
 * import { FigmaMultiplayerClient, getCookiesFromDevTools } from './multiplayer'
 * 
 * const cookies = await getCookiesFromDevTools()
 * const client = new FigmaMultiplayerClient('fileKey')
 * await client.connect(cookies)
 * 
 * await client.createNodes([{
 *   guid: { sessionID: client.getSessionInfo()!.sessionID, localID: 1 },
 *   phase: 'CREATED',
 *   type: 'RECTANGLE',
 *   name: 'My Rect',
 *   // ...
 * }])
 * 
 * client.close()
 * ```
 */

export { 
  FigmaMultiplayerClient, 
  getCookiesFromDevTools,
  parseFileKey,
  type SessionInfo,
  type ConnectionOptions,
} from './client.ts'

export {
  initCodec,
  encodeMessage,
  decodeMessage,
  createNodeChangesMessage,
  createNodeChange,
  type GUID,
  type Color,
  type Paint,
  type Transform,
  type Size,
  type ParentIndex,
  type NodeChange,
  type FigmaMessage,
} from './codec.ts'

export {
  MESSAGE_TYPES,
  NODE_TYPES,
  NODE_PHASES,
  BLEND_MODES,
  PAINT_TYPES,
  PROTOCOL_VERSION,
  KIWI,
  SESSION_ID,
  ZSTD_MAGIC,
  buildMultiplayerUrl,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
  isKiwiMessage,
  getKiwiMessageType,
  parseVarint,
} from './protocol.ts'
