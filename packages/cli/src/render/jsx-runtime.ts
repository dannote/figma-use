/**
 * Custom JSX Runtime for Figma components
 *
 * This module provides jsx/jsxs functions that produce TreeNode objects
 * instead of React elements.
 */

import { node, type BaseProps, type TreeNode, type TextProps } from './tree.ts'

export function jsx(type: string | ((props: BaseProps) => TreeNode), props: BaseProps): TreeNode {
  if (typeof type === 'function') {
    return type(props)
  }
  return node(type, props)
}

export const jsxs = jsx
export const jsxDEV = jsx

// Fragment just returns children
export function Fragment({ children }: { children?: unknown }): TreeNode {
  return node('fragment', { children } as BaseProps)
}

// SVG element props
interface SvgProps {
  width?: string | number
  height?: string | number
  viewBox?: string
  fill?: string
  children?: unknown
}

interface PathProps {
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: string | number
  fillRule?: string
  clipRule?: string
}

interface RectProps {
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  rx?: string | number
  ry?: string | number
  fill?: string
  stroke?: string
}

interface CircleProps {
  cx?: string | number
  cy?: string | number
  r?: string | number
  fill?: string
  stroke?: string
}

// JSX namespace for TypeScript
export namespace JSX {
  export type Element = TreeNode

  export interface IntrinsicElements {
    frame: BaseProps
    text: TextProps
    rectangle: BaseProps
    ellipse: BaseProps
    line: BaseProps
    star: BaseProps & { points?: number; innerRadius?: number }
    polygon: BaseProps & { pointCount?: number }
    vector: BaseProps
    group: BaseProps
    image: BaseProps & { src: string }
    // Figma SVG component with src string
    SVG: BaseProps & { src: string }
    // Native SVG elements (inline)
    svg: SvgProps
    path: PathProps
    rect: RectProps
    circle: CircleProps
    g: { children?: unknown; fill?: string; stroke?: string }
  }

  export interface ElementChildrenAttribute {
    children: {}
  }
}
