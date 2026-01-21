import { loadIcon } from '@iconify/core/lib/api/icons'
import { setAPIModule } from '@iconify/core/lib/api/modules'
import { fetchAPIModule } from '@iconify/core/lib/api/modules/fetch'
import { iconToSVG } from '@iconify/utils'

import type { Props, ReactElement } from './tree.ts'
import type { IconifyIcon } from '@iconify/types'
import type { ReactNode } from 'react'

// Initialize API module
setAPIModule('', fetchAPIModule)

export interface IconData {
  svg: string
  width: number
  height: number
  body: string
  viewBox: { left: number; top: number; width: number; height: number }
}

const iconCache = new Map<string, IconData>()

// Raw icon data cache (before size transformation)
const rawIconCache = new Map<string, IconifyIcon>()

/**
 * Load raw icon data (without size transformation)
 */
async function loadRawIcon(name: string): Promise<IconifyIcon | null> {
  if (rawIconCache.has(name)) {
    return rawIconCache.get(name)!
  }

  const icon = await loadIcon(name)
  if (!icon) {
    return null
  }

  rawIconCache.set(name, icon)
  return icon
}

/**
 * Load icon from Iconify and return SVG string
 * @param name Icon name in format "prefix:name" (e.g., "mdi:home", "lucide:star")
 * @param size Optional size (default: 24)
 */
export async function loadIconSvg(name: string, size: number = 24): Promise<IconData | null> {
  const cacheKey = `${name}@${size}`

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!
  }

  const icon = await loadRawIcon(name)
  if (!icon) {
    return null
  }

  const result = iconToSVG(icon, { height: size, width: size })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${Object.entries(result.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')}>${result.body}</svg>`

  const data: IconData = {
    svg,
    width: size,
    height: size,
    body: result.body,
    viewBox: {
      left: result.viewBox[0],
      top: result.viewBox[1],
      width: result.viewBox[2],
      height: result.viewBox[3]
    }
  }

  iconCache.set(cacheKey, data)
  return data
}

/**
 * Get cached icon data (synchronous, for use in React components)
 * Returns null if icon not preloaded
 */
export function getIconData(name: string, size: number = 24): IconData | null {
  return iconCache.get(`${name}@${size}`) || null
}

/**
 * Preload icons for use in JSX render
 * Call before rendering to ensure icons are available synchronously
 */
export async function preloadIcons(icons: Array<{ name: string; size?: number }>): Promise<void> {
  await Promise.all(icons.map(({ name, size }) => loadIconSvg(name, size || 24)))
}

/**
 * Get list of popular icon sets
 */
export const iconSets = {
  mdi: 'Material Design Icons',
  lucide: 'Lucide',
  heroicons: 'Heroicons',
  'heroicons-outline': 'Heroicons Outline',
  'heroicons-solid': 'Heroicons Solid',
  tabler: 'Tabler Icons',
  'fa-solid': 'Font Awesome Solid',
  'fa-regular': 'Font Awesome Regular',
  'fa-brands': 'Font Awesome Brands',
  ri: 'Remix Icon',
  ph: 'Phosphor',
  'ph-bold': 'Phosphor Bold',
  'ph-fill': 'Phosphor Fill',
  carbon: 'Carbon',
  fluent: 'Fluent UI',
  ion: 'Ionicons',
  bi: 'Bootstrap Icons'
}

/**
 * Recursively collect Icon primitives from React element tree
 */
export function collectIcons(element: ReactNode): Array<{ name: string; size?: number }> {
  const icons: Array<{ name: string; size?: number }> = []

  function traverse(node: ReactNode): void {
    if (!node || typeof node !== 'object') return

    if (Array.isArray(node)) {
      node.forEach(traverse)
      return
    }

    const el = node as ReactElement
    if (!el.type) return

    if (el.type === 'icon') {
      const props = el.props as { icon?: string; size?: number }
      if (props.icon) {
        icons.push({ name: props.icon, size: props.size })
      }
    }

    if (typeof el.type === 'function') {
      try {
        const rendered = (el.type as (p: Props) => ReactNode)(el.props as Props)
        if (rendered) traverse(rendered)
      } catch {
        // Ignore render errors during collection
      }
    }

    const props = el.props as { children?: ReactNode }
    if (props.children) {
      if (Array.isArray(props.children)) {
        props.children.forEach(traverse)
      } else {
        traverse(props.children)
      }
    }
  }

  traverse(element)
  return icons
}
