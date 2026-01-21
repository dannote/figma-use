/**
 * JSX → Figma Widget API renderer
 */

import { sendCommand } from '../client.ts'
import { isTreeNode, type TreeNode, type ReactElement, type Props } from './tree.ts'

function isReactElement(x: unknown): x is ReactElement {
  return x !== null && typeof x === 'object' && 'type' in x && 'props' in x
}

function convertReactElementToTree(el: ReactElement): TreeNode {
  const children: (TreeNode | string)[] = []
  const elChildren = el.props.children
  
  if (elChildren != null) {
    const childArray = Array.isArray(elChildren) ? elChildren : [elChildren]
    for (const child of childArray.flat()) {
      if (child == null) continue
      if (typeof child === 'string' || typeof child === 'number') {
        children.push(String(child))
      } else if (isReactElement(child)) {
        const resolved = resolveElement(child)
        if (resolved) children.push(resolved)
      }
    }
  }
  
  const { children: _, ...props } = el.props
  return { type: el.type as string, props, children }
}

function resolveElement(element: unknown, depth = 0): TreeNode | null {
  if (depth > 100) throw new Error('Component resolution depth exceeded')
  if (isTreeNode(element)) return element
  
  if (isReactElement(element)) {
    if (typeof element.type === 'function') {
      return resolveElement((element.type as (p: Props) => unknown)(element.props), depth + 1)
    }
    if (typeof element.type === 'string') {
      return convertReactElementToTree(element)
    }
  }
  
  return null
}

export async function renderWithWidgetApi(
  element: unknown,
  options?: { x?: number; y?: number; parent?: string }
): Promise<{ id: string; name: string }> {
  const tree = typeof element === 'function' 
    ? element() 
    : resolveElement(element)

  if (!tree) {
    throw new Error('Root must be a Figma component (Frame, Text, etc)')
  }

  return sendCommand('create-from-jsx', {
    tree,
    x: options?.x,
    y: options?.y,
    parentId: options?.parent
  })
}
