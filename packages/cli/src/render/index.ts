/**
 * React → Figma Renderer
 */

export { renderWithWidgetApi } from './widget-renderer.ts'

export {
  Frame,
  Text,
  Rectangle,
  Ellipse,
  Line,
  Image,
  SVG,
  View,
  Rect,
  Star,
  Polygon,
  Vector,
  Component,
  Instance,
  Group,
  Page,
  Icon,
  INTRINSIC_ELEMENTS,
  defineVars,
  figmaVar,
  isVariable,
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  type FigmaVariable,
  defineComponent,
  resetComponentRegistry,
  getComponentRegistry
} from './components.tsx'

export { preloadIcons, loadIconSvg, getIconData, collectIcons } from './icon.ts'

export { renderJsx } from './render-jsx.ts'

export {
  defineComponentSet,
  resetComponentSetRegistry,
  getComponentSetRegistry
} from './component-set.tsx'

export { buildComponent, readStdin, renderFromString } from './render-from-string.ts'
