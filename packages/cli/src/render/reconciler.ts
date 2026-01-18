/**
 * React Reconciler that outputs Figma NodeChanges directly
 * 
 * Renders React components directly to NodeChanges array
 * ready for multiplayer WebSocket transmission
 */

import Reconciler from 'react-reconciler'
import { consola } from 'consola'
import type { NodeChange, Paint } from '../multiplayer/codec.ts'
import { parseColor } from '../color.ts'
import { isVariable, resolveVariable, type FigmaVariable } from './vars.ts'
import { getComponentRegistry } from './components.tsx'

// Track rendered components: symbol -> GUID
const renderedComponents = new Map<symbol, { sessionID: number; localID: number }>()

export interface RenderOptions {
  sessionID: number
  parentGUID: { sessionID: number; localID: number }
  startLocalID?: number
}

export interface RenderResult {
  nodeChanges: NodeChange[]
  nextLocalID: number
}

interface Instance {
  type: string
  props: Record<string, unknown>
  localID: number
  children: Instance[]
  textContent?: string
}

interface Container {
  options: RenderOptions
  localIDCounter: number
  children: Instance[]
}



function styleToNodeChange(
  type: string,
  props: Record<string, unknown>,
  localID: number,
  sessionID: number,
  parentGUID: { sessionID: number; localID: number },
  position: string,
  textContent?: string
): NodeChange {
  const style = (props.style || {}) as Record<string, unknown>
  const name = (props.name as string) || type
  
  const nodeChange: NodeChange = {
    guid: { sessionID, localID },
    phase: 'CREATED',
    parentIndex: { guid: parentGUID, position },
    type: mapType(type),
    name,
    visible: true,
    opacity: typeof style.opacity === 'number' ? style.opacity : 1,
  }
  
  // Size
  const width = style.width ?? props.width
  const height = style.height ?? props.height
  if (width !== undefined && height !== undefined) {
    nodeChange.size = { x: Number(width), y: Number(height) }
  } else if (width !== undefined) {
    nodeChange.size = { x: Number(width), y: 1 } // minimal height for auto-sizing
  } else if (height !== undefined) {
    nodeChange.size = { x: 1, y: Number(height) } // minimal width for auto-sizing
  } else if (type !== 'TEXT') {
    // Minimal size for auto-layout to expand from
    nodeChange.size = { x: 1, y: 1 }
  }
  
  // Position (transform)
  const x = Number(style.x ?? props.x ?? 0)
  const y = Number(style.y ?? props.y ?? 0)
  nodeChange.transform = {
    m00: 1, m01: 0, m02: x,
    m10: 0, m11: 1, m12: y,
  }
  
  // Background color → fill (supports Figma variables)
  if (style.backgroundColor) {
    const bgColor = style.backgroundColor
    if (isVariable(bgColor)) {
      const resolved = resolveVariable(bgColor)
      // Use explicit value as fallback, or black
      const fallback = bgColor.value ? parseColor(bgColor.value) : { r: 0, g: 0, b: 0, a: 1 }
      nodeChange.fillPaints = [{
        type: 'SOLID',
        color: { r: fallback.r, g: fallback.g, b: fallback.b, a: fallback.a },
        opacity: 1,
        visible: true,
        colorVariableBinding: {
          variableID: { sessionID: resolved.sessionID, localID: resolved.localID }
        }
      } as Paint]
    } else {
      const color = parseColor(bgColor as string)
      nodeChange.fillPaints = [{
        type: 'SOLID',
        color: { r: color.r, g: color.g, b: color.b, a: color.a },
        opacity: color.a,
        visible: true,
      }]
    }
  }
  
  // Border → stroke (supports Figma variables)
  if (style.borderColor) {
    const borderColor = style.borderColor
    if (isVariable(borderColor)) {
      const resolved = resolveVariable(borderColor)
      const fallback = borderColor.value ? parseColor(borderColor.value) : { r: 0, g: 0, b: 0, a: 1 }
      nodeChange.strokePaints = [{
        type: 'SOLID',
        color: { r: fallback.r, g: fallback.g, b: fallback.b, a: fallback.a },
        opacity: 1,
        visible: true,
        colorVariableBinding: {
          variableID: { sessionID: resolved.sessionID, localID: resolved.localID }
        }
      } as Paint]
    } else {
      const color = parseColor(borderColor as string)
      nodeChange.strokePaints = [{
        type: 'SOLID',
        color: { r: color.r, g: color.g, b: color.b, a: color.a },
        opacity: color.a,
        visible: true,
      }]
    }
    nodeChange.strokeWeight = Number(style.borderWidth ?? 1)
  }
  
  // Corner radius
  if (style.borderRadius !== undefined) {
    nodeChange.cornerRadius = Number(style.borderRadius)
  }
  if (style.borderTopLeftRadius !== undefined) {
    nodeChange.rectangleTopLeftCornerRadius = Number(style.borderTopLeftRadius)
    nodeChange.rectangleCornerRadiiIndependent = true
  }
  if (style.borderTopRightRadius !== undefined) {
    nodeChange.rectangleTopRightCornerRadius = Number(style.borderTopRightRadius)
    nodeChange.rectangleCornerRadiiIndependent = true
  }
  if (style.borderBottomLeftRadius !== undefined) {
    nodeChange.rectangleBottomLeftCornerRadius = Number(style.borderBottomLeftRadius)
    nodeChange.rectangleCornerRadiiIndependent = true
  }
  if (style.borderBottomRightRadius !== undefined) {
    nodeChange.rectangleBottomRightCornerRadius = Number(style.borderBottomRightRadius)
    nodeChange.rectangleCornerRadiiIndependent = true
  }
  
  // Auto-layout
  if (style.flexDirection) {
    nodeChange.stackMode = style.flexDirection === 'row' ? 'HORIZONTAL' : 'VERTICAL'
    // Sizing mode: FIXED if size specified, otherwise RESIZE_TO_FIT (hug contents)
    const isRow = style.flexDirection === 'row'
    const primarySize = isRow ? width : height
    const counterSize = isRow ? height : width
    nodeChange.stackPrimarySizing = primarySize !== undefined ? 'FIXED' : 'RESIZE_TO_FIT'
    nodeChange.stackCounterSizing = counterSize !== undefined ? 'FIXED' : 'RESIZE_TO_FIT'
  }
  if (style.gap !== undefined) {
    nodeChange.stackSpacing = Number(style.gap)
  }
  
  // Padding
  const pt = style.paddingTop ?? style.padding
  const pr = style.paddingRight ?? style.padding
  const pb = style.paddingBottom ?? style.padding
  const pl = style.paddingLeft ?? style.padding
  
  if (pt !== undefined) (nodeChange as unknown as Record<string, unknown>).stackVerticalPadding = Number(pt)
  if (pl !== undefined) (nodeChange as unknown as Record<string, unknown>).stackHorizontalPadding = Number(pl)
  if (pr !== undefined) nodeChange.stackPaddingRight = Number(pr)
  if (pb !== undefined) nodeChange.stackPaddingBottom = Number(pb)
  
  // Alignment
  if (style.justifyContent) {
    const validValues: Record<string, string> = {
      'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'space-evenly': 'SPACE_EVENLY'
    }
    const mapped = validValues[style.justifyContent as string]
    if (mapped) {
      nodeChange.stackPrimaryAlignItems = mapped
    } else {
      consola.warn(`justifyContent: "${style.justifyContent}" not supported, using "flex-start"`)
      nodeChange.stackPrimaryAlignItems = 'MIN'
    }
  }
  if (style.alignItems) {
    const validValues: Record<string, string> = {
      'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'stretch': 'STRETCH'
    }
    const mapped = validValues[style.alignItems as string]
    if (mapped) {
      nodeChange.stackCounterAlignItems = mapped
    } else {
      consola.warn(`alignItems: "${style.alignItems}" not supported, using "flex-start"`)
      nodeChange.stackCounterAlignItems = 'MIN'
    }
  }
  
  // Text-specific
  if (type.toLowerCase() === 'text' && textContent) {
    // Text content via textData.characters
    const nc = nodeChange as unknown as Record<string, unknown>
    nc.textData = { characters: textContent }
    nc.textAutoResize = 'WIDTH_AND_HEIGHT'
    nc.textAlignVertical = 'TOP'  // Required for text height calculation
    
    if (style.fontSize) nc.fontSize = Number(style.fontSize)
    // Set lineHeight to 100% (AUTO in Figma = 100% of fontSize)
    nc.lineHeight = { value: 100, units: 'PERCENT' }
    // Always set fontName for TEXT nodes (required for text to render)
    const family = (style.fontFamily as string) || 'Inter'
    const fontStyle = mapFontWeight(style.fontWeight as string)
    nc.fontName = {
      family,
      style: fontStyle,
      postscript: `${family}-${fontStyle}`.replace(/\s+/g, ''),
    }
    if (style.textAlign) {
      const map: Record<string, string> = { 'left': 'LEFT', 'center': 'CENTER', 'right': 'RIGHT' }
      nc.textAlignHorizontal = map[style.textAlign as string] || 'LEFT'
    }
    if (style.color) {
      const textColor = style.color
      if (isVariable(textColor)) {
        const resolved = resolveVariable(textColor)
        const fallback = textColor.value ? parseColor(textColor.value) : { r: 0, g: 0, b: 0, a: 1 }
        nodeChange.fillPaints = [{
          type: 'SOLID',
          color: { r: fallback.r, g: fallback.g, b: fallback.b, a: fallback.a },
          opacity: 1,
          visible: true,
          colorVariableBinding: {
            variableID: { sessionID: resolved.sessionID, localID: resolved.localID }
          }
        } as Paint]
      } else {
        const color = parseColor(textColor as string)
        nodeChange.fillPaints = [{
          type: 'SOLID',
          color: { r: color.r, g: color.g, b: color.b, a: color.a },
          opacity: color.a,
          visible: true,
        }]
      }
    }
  }
  
  // Instance - link to component
  if (type.toLowerCase() === 'instance' && props.componentId) {
    const match = String(props.componentId).match(/(\d+):(\d+)/)
    if (match) {
      const nc = nodeChange as unknown as Record<string, unknown>
      nc.symbolData = {
        symbolID: {
          sessionID: parseInt(match[1], 10),
          localID: parseInt(match[2], 10),
        }
      }
    }
  }
  
  return nodeChange
}

function mapType(type: string): string {
  const map: Record<string, string> = {
    frame: 'FRAME',
    rectangle: 'RECTANGLE',
    ellipse: 'ELLIPSE',
    text: 'TEXT',
    line: 'LINE',
    star: 'STAR',
    polygon: 'REGULAR_POLYGON',
    vector: 'VECTOR',
    component: 'SYMBOL',      // Figma internally calls components "symbols"
    instance: 'INSTANCE',
    group: 'GROUP',
    page: 'CANVAS',
  }
  return map[type.toLowerCase()] || 'FRAME'
}

function mapFontWeight(weight?: string): string {
  if (!weight) return 'Regular'
  const map: Record<string, string> = {
    'normal': 'Regular',
    'bold': 'Bold',
    '100': 'Thin',
    '200': 'Extra Light',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'Semi Bold',
    '700': 'Bold',
    '800': 'Extra Bold',
    '900': 'Black',
  }
  return map[weight] || 'Regular'
}

function collectNodeChanges(
  instance: Instance,
  sessionID: number,
  parentGUID: { sessionID: number; localID: number },
  position: string,
  result: NodeChange[],
  container: Container
): void {
  // Handle defineComponent instances
  if (instance.type === '__component_instance__') {
    const sym = instance.props.__componentSymbol as symbol
    const name = instance.props.__componentName as string
    const registry = getComponentRegistry()
    const def = registry.get(sym)
    
    if (!def) {
      consola.error(`Component "${name}" not found in registry`)
      return
    }
    
    // Check if component already rendered
    let componentGUID = renderedComponents.get(sym)
    
    if (!componentGUID) {
      // First instance: render as Component
      const componentLocalID = container.localIDCounter++
      componentGUID = { sessionID, localID: componentLocalID }
      renderedComponents.set(sym, componentGUID)
      
      // Render the component's element tree
      const componentResult = renderToNodeChanges(def.element, {
        sessionID,
        parentGUID, // Will be fixed below
        startLocalID: container.localIDCounter,
      })
      
      // Update counter
      container.localIDCounter = componentResult.nextLocalID
      
      // Change first node to be SYMBOL type and add to results
      if (componentResult.nodeChanges.length > 0) {
        const rootChange = componentResult.nodeChanges[0]
        const originalRootGUID = { ...rootChange.guid }
        
        // Replace root node's guid with componentGUID
        rootChange.guid = componentGUID
        rootChange.type = 'SYMBOL'
        rootChange.name = name
        rootChange.parentIndex = { guid: parentGUID, position }
        
        // Fix children's parentIndex to point to componentGUID instead of original root
        for (let i = 1; i < componentResult.nodeChanges.length; i++) {
          const child = componentResult.nodeChanges[i]
          if (child.parentIndex?.guid.localID === originalRootGUID.localID &&
              child.parentIndex?.guid.sessionID === originalRootGUID.sessionID) {
            child.parentIndex.guid = componentGUID
          }
        }
        
        // Merge style props from instance onto component
        const style = (instance.props.style || {}) as Record<string, unknown>
        if (style.x !== undefined || style.y !== undefined) {
          const x = Number(style.x ?? 0)
          const y = Number(style.y ?? 0)
          rootChange.transform = { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y }
        }
        
        result.push(...componentResult.nodeChanges)
      }
    } else {
      // Subsequent instance: create Instance node
      const instanceLocalID = container.localIDCounter++
      const style = (instance.props.style || {}) as Record<string, unknown>
      const x = Number(style.x ?? 0)
      const y = Number(style.y ?? 0)
      
      const instanceChange: NodeChange = {
        guid: { sessionID, localID: instanceLocalID },
        phase: 'CREATED',
        parentIndex: { guid: parentGUID, position },
        type: 'INSTANCE',
        name,
        visible: true,
        opacity: 1,
        transform: { m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y },
      }
      
      // Link to component
      const nc = instanceChange as unknown as Record<string, unknown>
      nc.symbolData = { symbolID: componentGUID }
      
      result.push(instanceChange)
    }
    return
  }
  
  const nodeChange = styleToNodeChange(
    instance.type,
    instance.props,
    instance.localID,
    sessionID,
    parentGUID,
    position,
    instance.textContent
  )
  result.push(nodeChange)
  
  const thisGUID = { sessionID, localID: instance.localID }
  instance.children.forEach((child, i) => {
    const childPosition = String.fromCharCode(33 + (i % 90))
    collectNodeChanges(child, sessionID, thisGUID, childPosition, result, container)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hostConfig: any = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  
  now: Date.now,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1 as const,
  
  getRootHostContext() {
    return {}
  },
  
  getChildHostContext() {
    return {}
  },
  
  shouldSetTextContent() {
    return false
  },
  
  createInstance(
    type: string,
    props: Record<string, unknown>,
    _rootContainer: Container,
  ): Instance {
    const { children: _, ...rest } = props
    return {
      type,
      props: rest,
      localID: _rootContainer.localIDCounter++,
      children: [],
    }
  },
  
  createTextInstance(
    text: string,
  ): Instance {
    return {
      type: '__text__',
      props: {},
      localID: -1,
      children: [],
      textContent: text,
    }
  },
  
  appendInitialChild(parent: Instance, child: Instance): void {
    if (child.type === '__text__') {
      parent.textContent = (parent.textContent || '') + (child.textContent || '')
    } else {
      parent.children.push(child)
    }
  },
  
  appendChild(parent: Instance, child: Instance): void {
    if (child.type === '__text__') {
      parent.textContent = (parent.textContent || '') + (child.textContent || '')
    } else {
      parent.children.push(child)
    }
  },
  
  appendChildToContainer(container: Container, child: Instance): void {
    if (child.type !== '__text__') {
      container.children.push(child)
    }
  },
  
  removeChild(parent: Instance, child: Instance): void {
    const index = parent.children.indexOf(child)
    if (index !== -1) parent.children.splice(index, 1)
  },
  
  removeChildFromContainer(container: Container, child: Instance): void {
    const index = container.children.indexOf(child)
    if (index !== -1) container.children.splice(index, 1)
  },
  
  insertBefore(parent: Instance, child: Instance, beforeChild: Instance): void {
    if (child.type === '__text__') return
    const index = parent.children.indexOf(beforeChild)
    if (index !== -1) {
      parent.children.splice(index, 0, child)
    } else {
      parent.children.push(child)
    }
  },
  
  insertInContainerBefore(container: Container, child: Instance, beforeChild: Instance): void {
    if (child.type === '__text__') return
    const index = container.children.indexOf(beforeChild)
    if (index !== -1) {
      container.children.splice(index, 0, child)
    } else {
      container.children.push(child)
    }
  },
  
  prepareForCommit(): Record<string, unknown> | null {
    return null
  },
  
  resetAfterCommit(): void {},
  
  clearContainer(container: Container): void {
    container.children = []
  },
  
  finalizeInitialChildren() {
    return false
  },
  
  prepareUpdate() {
    return true
  },
  
  commitUpdate(
    instance: Instance,
    _updatePayload: unknown,
    _type: string,
    _prevProps: Record<string, unknown>,
    nextProps: Record<string, unknown>
  ): void {
    const { children: _, ...rest } = nextProps
    instance.props = rest
  },
  
  commitTextUpdate(
    textInstance: Instance,
    _oldText: string,
    newText: string
  ): void {
    textInstance.textContent = newText
  },
  
  getPublicInstance(instance: Instance): Instance {
    return instance
  },
  
  preparePortalMount() {},
  
  getCurrentEventPriority() {
    return 16 // DefaultEventPriority
  },
  
  getInstanceFromNode() {
    return null
  },
  
  beforeActiveInstanceBlur() {},
  
  afterActiveInstanceBlur() {},
  
  prepareScopeUpdate() {},
  
  getInstanceFromScope() {
    return null
  },
  
  detachDeletedInstance() {},
}

/**
 * Render a React element directly to NodeChanges
 */
export function renderToNodeChanges(
  element: React.ReactElement,
  options: RenderOptions
): RenderResult {
  const container: Container = {
    options,
    localIDCounter: options.startLocalID ?? 1,
    children: [],
  }
  
  const reconciler = Reconciler(hostConfig)
  
  const root = reconciler.createContainer(
    container,
    0,          // tag: LegacyRoot
    null,       // hydrationCallbacks
    false,      // isStrictMode
    null,       // concurrentUpdatesByDefaultOverride
    '',         // identifierPrefix
    () => {},   // onUncaughtError
    () => {},   // onCaughtError
    () => {},   // onRecoverableError
    () => {},   // onDefaultTransitionIndicator
    null        // transitionCallbacks
  )
  
  reconciler.updateContainer(element, root, null, () => {})
  reconciler.flushSync(() => {})
  
  const nodeChanges: NodeChange[] = []
  container.children.forEach((child, i) => {
    const position = String.fromCharCode(33 + (i % 90))
    collectNodeChanges(child, options.sessionID, options.parentGUID, position, nodeChanges, container)
  })
  
  return {
    nodeChanges,
    nextLocalID: container.localIDCounter,
  }
}

// Reset component tracking between renders
export function resetRenderedComponents() {
  renderedComponents.clear()
}
