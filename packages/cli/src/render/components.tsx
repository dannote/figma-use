/**
 * Figma JSX Components
 *
 * Returns TreeNode objects for Figma Widget API rendering.
 * Use @ts-expect-error in .figma.tsx files if TypeScript complains about JSX types.
 */

import { node, type BaseProps, type TextProps, type TreeNode } from './tree.ts'

// Core components
export function Frame(props: BaseProps): TreeNode {
  return node('frame', props)
}

export function Text(props: TextProps): TreeNode {
  return node('text', props)
}

export function Rectangle(props: BaseProps): TreeNode {
  return node('rectangle', props)
}

export function Ellipse(props: BaseProps): TreeNode {
  return node('ellipse', props)
}

export function Line(props: BaseProps): TreeNode {
  return node('line', props)
}

export function Image(props: BaseProps & { src: string }): TreeNode {
  return node('image', props)
}

export function SVG(props: BaseProps & { src: string }): TreeNode {
  return node('svg', props)
}

export function Star(props: BaseProps & { points?: number; innerRadius?: number }): TreeNode {
  return node('star', props)
}

export function Polygon(props: BaseProps & { pointCount?: number }): TreeNode {
  return node('polygon', props)
}

export function Vector(props: BaseProps): TreeNode {
  return node('vector', props)
}

export function Group(props: BaseProps): TreeNode {
  return node('group', props)
}

export function Section(props: BaseProps): TreeNode {
  return node('section', props)
}

// Aliases
export const View = Frame
export const Rect = Rectangle
export const Component = Frame
export const Instance = Frame
export const Page = Frame

// Intrinsic elements
export const INTRINSIC_ELEMENTS = [
  'frame',
  'text',
  'rectangle',
  'ellipse',
  'line',
  'image',
  'svg',
  'star',
  'polygon',
  'vector',
  'group',
  'section'
]

// Variables
export {
  defineVars,
  figmaVar,
  isVariable,
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  type FigmaVariable
} from './vars.ts'

// Legacy component registry
const componentRegistry = new Map<symbol, { name: string; element: unknown }>()
export const resetComponentRegistry = () => componentRegistry.clear()
export const getComponentRegistry = () => componentRegistry

export function defineComponent(name: string, element: unknown) {
  const sym = Symbol(name)
  componentRegistry.set(sym, { name, element })
  return () => element
}

// Icon
export interface IconProps {
  icon: string
  size?: number
  color?: string
}

export function Icon(props: IconProps) {
  return { __icon: true, ...props }
}

// Re-export types
export type { BaseProps, TextProps, StyleProps, TreeNode } from './tree.ts'
