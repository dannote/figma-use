/**
 * JSX → Figma Widget API renderer
 */

import { sendCommand } from '../client.ts'
import { loadIconSvg } from './icon.ts'
import { isTreeNode, type TreeNode, type ReactElement, type Props } from './tree.ts'

interface IconNode {
  __icon: true
  name: string
  size?: number
  color?: string
}

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

function isIconNode(x: unknown): x is IconNode {
  return x !== null && typeof x === 'object' && '__icon' in x && (x as IconNode).__icon === true
}

function resolveElement(element: unknown, depth = 0): TreeNode | null {
  if (depth > 100) throw new Error('Component resolution depth exceeded')
  if (isTreeNode(element)) return element

  // Icon nodes are handled separately in processIcons
  if (isIconNode(element)) {
    return {
      type: '__icon__',
      props: { name: element.name, size: element.size, color: element.color },
      children: []
    }
  }

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

async function processIcons(tree: TreeNode): Promise<TreeNode> {
  if (tree.type === '__icon__') {
    const { name, size = 24, color } = tree.props as { name: string; size?: number; color?: string }
    const iconData = await loadIconSvg(name, size)
    if (!iconData) {
      throw new Error(`Icon not found: ${name}`)
    }

    // Convert to SVG node with fill color
    let svg = iconData.svg
    if (color) {
      svg = svg.replace(/currentColor/g, color)
    }

    return {
      type: 'svg',
      props: { src: svg, w: size, h: size, name },
      children: []
    }
  }

  // Process children recursively
  const children = await Promise.all(
    tree.children.map(async (child) => {
      if (typeof child === 'string') return child
      return processIcons(child)
    })
  )

  return { ...tree, children }
}

export async function renderWithWidgetApi(
  element: unknown,
  options?: { x?: number; y?: number; parent?: string }
): Promise<{ id: string; name: string }> {
  let tree = typeof element === 'function' ? element() : resolveElement(element)

  if (!tree) {
    throw new Error('Root must be a Figma component (Frame, Text, etc)')
  }

  // Process icons (load SVG data)
  tree = await processIcons(tree)

  return sendCommand('create-from-jsx', {
    tree,
    x: options?.x,
    y: options?.y,
    parentId: options?.parent
  })
}
