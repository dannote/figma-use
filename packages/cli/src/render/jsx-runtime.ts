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
    svg: BaseProps & { src: string }
  }

  export interface ElementChildrenAttribute {
    children: {}
  }
}
