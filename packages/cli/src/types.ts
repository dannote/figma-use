export interface FigmaNode {
  id: string
  name: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  fills?: FigmaPaint[]
  strokes?: FigmaPaint[]
  strokeWeight?: number
  cornerRadius?: number
  opacity?: number
  visible?: boolean
  locked?: boolean
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisSizingMode?: 'FIXED' | 'AUTO'
  counterAxisSizingMode?: 'FIXED' | 'AUTO'
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL'
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL'
  itemSpacing?: number
  padding?: { top: number; right: number; bottom: number; left: number }
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
  children?: FigmaNode[]
  characters?: string
  fontSize?: number
  fontFamily?: string
  fontStyle?: string
  fontWeight?: number
  textAutoResize?: 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'NONE' | 'TRUNCATE'
  textPropertyRef?: string
  childCount?: number
  svgData?: string
  matchedIcon?: string
  matchedIconSimilarity?: number
}

export interface FigmaPaint {
  type: string
  color?: string
  opacity?: number
}

export interface FigmaViewport {
  center: { x: number; y: number }
  zoom: number
  bounds: { x: number; y: number; width: number; height: number }
}

export interface FigmaPage {
  id: string
  name: string
}

export interface ChromeDevToolsTarget {
  id: string
  title: string
  type: string
  url: string
  webSocketDebuggerUrl?: string
}

export interface ExportResult {
  data: string
  filename?: string
}

export interface CommandResult {
  result?: unknown
  error?: string
}

export interface DeletedResult {
  deleted: boolean
}

export interface StatusResult {
  pluginConnected: boolean
}

export type { FormatOptions } from 'oxfmt'
