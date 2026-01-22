export type Severity = 'error' | 'warning' | 'info' | 'off'

export type Category =
  | 'design-tokens'
  | 'layout'
  | 'typography'
  | 'accessibility'
  | 'naming'
  | 'structure'
  | 'components'

export interface RuleMeta {
  id: string
  severity: Severity
  category: Category
  description: string
  fixable?: boolean
  docs?: string
}

export interface LintMessage {
  ruleId: string
  severity: Severity
  message: string
  nodeId: string
  nodeName: string
  nodePath: string[]
  suggest?: string
  fix?: FixAction
}

export interface FixAction {
  action: 'set-fill' | 'set-stroke' | 'bind-variable' | 'rename' | 'set-layout' | 'resize'
  params: Record<string, unknown>
}

export interface RuleContext {
  report(issue: {
    node: FigmaNode
    message: string
    suggest?: string
    fix?: FixAction
  }): void
  
  getVariables(): FigmaVariable[]
  findSimilarVariable(color: RGB, type: 'COLOR'): FigmaVariable | null
  findSimilarVariable(value: number, type: 'FLOAT'): FigmaVariable | null
  getConfig<T = unknown>(): T
}

export interface Rule {
  meta: RuleMeta
  match?: string[]
  check(node: FigmaNode, context: RuleContext): void
}

export interface FigmaNode {
  id: string
  name: string
  type: string
  parent?: { id: string; name: string }
  children?: FigmaNode[]
  
  // Geometry
  width?: number
  height?: number
  x?: number
  y?: number
  rotation?: number
  
  // Styles
  fills?: Paint[]
  strokes?: Paint[]
  strokeWeight?: number
  cornerRadius?: number
  
  // Layout
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  itemSpacing?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  
  // Text
  characters?: string
  fontSize?: number
  fontName?: { family: string; style: string }
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' }
  textStyleId?: string
  
  // Components
  componentId?: string
  mainComponent?: { id: string; name: string }
  
  // Effects
  effects?: Effect[]
  
  // Visibility
  visible?: boolean
  locked?: boolean
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE'
  visible?: boolean
  opacity?: number
  color?: RGB
  boundVariables?: {
    color?: { id: string }
  }
}

export interface RGB {
  r: number
  g: number
  b: number
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  visible?: boolean
  radius?: number
  color?: RGB & { a: number }
  offset?: { x: number; y: number }
}

export interface FigmaVariable {
  id: string
  name: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, unknown>
}

export interface LintConfig {
  extends?: string | string[]
  rules: Record<string, Severity | { severity: Severity; options?: Record<string, unknown> }>
  ignore?: string[]
}

export interface LintResult {
  messages: LintMessage[]
  errorCount: number
  warningCount: number
  infoCount: number
  fixableCount: number
}
