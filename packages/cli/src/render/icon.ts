import { loadIcon } from '@iconify/core/lib/api/icons'
import { setAPIModule } from '@iconify/core/lib/api/modules'
import { fetchAPIModule } from '@iconify/core/lib/api/modules/fetch'
import { iconToSVG, iconToHTML } from '@iconify/utils'

// Initialize API module
setAPIModule('', fetchAPIModule)

export interface IconData {
  svg: string
  width: number
  height: number
}

const iconCache = new Map<string, IconData>()

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

  const icon = await loadIcon(name)
  if (!icon) {
    return null
  }

  const svg = iconToSVG(icon, { height: size, width: size })
  const html = iconToHTML(svg.body, svg.attributes)
  
  const data: IconData = {
    svg: html,
    width: size,
    height: size
  }
  
  iconCache.set(cacheKey, data)
  return data
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
