/**
 * React → Figma Renderer
 */

export {
  renderToNodeChanges,
  resetRenderedComponents,
  getPendingComponentSetInstances,
  clearPendingComponentSetInstances,
  getPendingIcons,
  clearPendingIcons,
  type RenderOptions,
  type RenderResult,
  type PendingComponentSetInstance,
  type PendingIcon
} from './reconciler.ts'
export {
  Frame,
  Rectangle,
  Ellipse,
  Text,
  Line,
  Star,
  Polygon,
  Vector,
  Component,
  Instance,
  Group,
  Page,
  View,
  Icon,
  INTRINSIC_ELEMENTS,
  // Variable bindings (StyleX-inspired)
  defineVars,
  figmaVar,
  isVariable,
  loadVariablesIntoRegistry,
  isRegistryLoaded,
  type FigmaVariable,
  // Component definitions
  defineComponent,
  resetComponentRegistry,
  getComponentRegistry
} from './components.tsx'

export { preloadIcons, loadIconSvg, getIconData, collectIcons } from './icon.ts'

export { transformJsxSnippet } from './jsx-transform.ts'

export {
  // ComponentSet (variants)
  defineComponentSet,
  resetComponentSetRegistry,
  getComponentSetRegistry
} from './component-set.tsx'
