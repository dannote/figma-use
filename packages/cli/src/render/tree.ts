/**
 * Figma Tree Node
 */

export type Props = Record<string, unknown>

export interface TreeNode {
  type: string
  props: Props
  children: (TreeNode | string)[]
  key?: string | number | null
}

export interface ReactElement {
  type: unknown
  props: Props
}

export function isTreeNode(x: unknown): x is TreeNode {
  if (x === null || typeof x !== 'object') return false
  const obj = x as Props
  return typeof obj.type === 'string' && 'props' in obj && Array.isArray(obj.children)
}

function isReactElement(x: unknown): x is ReactElement {
  return x !== null && typeof x === 'object' && 'type' in x && 'props' in x
}

function resolveReactElement(el: ReactElement): TreeNode | null {
  if (typeof el.type === 'function') {
    const result = (el.type as (p: Props) => unknown)(el.props)
    if (isTreeNode(result)) return result
    if (isReactElement(result)) return resolveReactElement(result)
  }
  return null
}

function processChild(child: unknown): TreeNode | string | null {
  if (child == null) return null
  if (typeof child === 'string' || typeof child === 'number') return String(child)
  if (isTreeNode(child)) return child
  if (isReactElement(child)) return resolveReactElement(child)
  return null
}

export function node(type: string, props: BaseProps): TreeNode {
  const { children, ...rest } = props
  const processed = [children]
    .flat(Infinity)
    .map(processChild)
    .filter((c): c is TreeNode | string => c !== null)
  return { type, props: rest, children: processed }
}

// Style props
export interface StyleProps {
  // Layout
  flex?: 'row' | 'col' | 'column'
  gap?: number
  wrap?: boolean
  rowGap?: number
  justify?: 'start' | 'end' | 'center' | 'between'
  items?: 'start' | 'end' | 'center'
  position?: 'absolute' | 'relative'
  grow?: number
  stretch?: boolean

  // Size
  w?: number | 'fill'
  h?: number | 'fill'
  width?: number | 'fill'
  height?: number | 'fill'
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number

  // Position
  x?: number
  y?: number

  // Padding
  p?: number
  px?: number
  py?: number
  pt?: number
  pr?: number
  pb?: number
  pl?: number
  padding?: number

  // Appearance
  bg?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeAlign?: 'inside' | 'outside' | 'center'
  strokeTop?: number
  strokeBottom?: number
  strokeLeft?: number
  strokeRight?: number
  rounded?: number
  cornerRadius?: number
  roundedTL?: number
  roundedTR?: number
  roundedBL?: number
  roundedBR?: number
  cornerSmoothing?: number
  opacity?: number
  blendMode?: string
  rotate?: number
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number

  // Text
  size?: number
  fontSize?: number
  font?: string
  fontFamily?: string
  weight?: number | 'bold' | 'medium' | 'normal'
  fontWeight?: number | 'bold' | 'medium' | 'normal'
  color?: string

  // Other
  src?: string
  href?: string
}

// Custom child type that allows TreeNode in JSX
type FigmaChild =
  | TreeNode
  | string
  | number
  | null
  | undefined
  | boolean
  | (TreeNode | string | number | null | undefined | boolean)[]

export interface BaseProps extends StyleProps {
  name?: string
  key?: string | number
  children?: FigmaChild
}

export interface TextProps extends BaseProps {
  children?: FigmaChild
}
