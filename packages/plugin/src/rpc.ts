import svgpath from 'svgpath'

import { queryNodes } from './query.ts'

console.log('[Figma Bridge] Plugin main loaded at', new Date().toISOString())

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function retry<T>(
  fn: () => Promise<T | null | undefined>,
  maxAttempts = 10,
  delayMs = 50,
  backoff: 'fixed' | 'linear' | 'exponential' = 'fixed'
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fn()
    if (result) return result
    if (attempt < maxAttempts - 1) {
      const delay =
        backoff === 'linear'
          ? delayMs * (attempt + 1)
          : backoff === 'exponential'
            ? delayMs * Math.pow(2, attempt)
            : delayMs
      await sleep(delay)
    }
  }
  return null
}

// Font cache to avoid repeated loadFontAsync calls
const loadedFonts = new Set<string>()
const fontLoadPromises = new Map<string, Promise<void>>()

// Preload common font
const interPromise = figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
fontLoadPromises.set('Inter:Regular', interPromise)
interPromise.then(() => loadedFonts.add('Inter:Regular'))

function loadFont(family: string, style: string): Promise<void> | void {
  const key = `${family}:${style}`
  if (loadedFonts.has(key)) return // sync return if cached

  // Check if already loading
  const pending = fontLoadPromises.get(key)
  if (pending) return pending

  // Start new load
  const promise = figma.loadFontAsync({ family, style })
  fontLoadPromises.set(key, promise)
  promise.then(() => {
    loadedFonts.add(key)
    fontLoadPromises.delete(key)
  })
  return promise
}

// Fast node creation for batch operations - skips full serialization
async function createNodeFast(
  command: string,
  args: Record<string, unknown> | undefined,
  nodeCache?: Map<string, SceneNode>,
  deferredLayouts?: Array<{
    frame: FrameNode
    layoutMode: 'HORIZONTAL' | 'VERTICAL'
    itemSpacing?: number
    padding?: { top: number; right: number; bottom: number; left: number }
  }>
): Promise<SceneNode | null> {
  if (!args) return null

  const {
    x = 0,
    y = 0,
    width,
    height,
    name,
    fill,
    stroke,
    strokeWeight,
    radius,
    opacity,
    layoutMode,
    itemSpacing,
    padding,
    text,
    fontSize,
    fontFamily,
    fontStyle
  } = args as {
    x?: number
    y?: number
    width?: number
    height?: number
    name?: string
    fill?: string
    stroke?: string
    strokeWeight?: number
    radius?: number
    opacity?: number
    layoutMode?: string
    itemSpacing?: number
    padding?: { top: number; right: number; bottom: number; left: number }
    text?: string
    fontSize?: number
    fontFamily?: string
    fontStyle?: string
  }

  let node: SceneNode | null = null

  switch (command) {
    case 'create-frame': {
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(width || 100, height || 100)
      if (name) frame.name = name
      if (fill) frame.fills = [{ type: 'SOLID', color: hexToRgb(getHexColor(fill)) }]
      if (stroke) frame.strokes = [{ type: 'SOLID', color: hexToRgb(getHexColor(stroke)) }]
      if (strokeWeight) frame.strokeWeight = strokeWeight
      if (typeof radius === 'number') frame.cornerRadius = radius
      if (typeof opacity === 'number') frame.opacity = opacity
      if (layoutMode && layoutMode !== 'NONE') {
        deferredLayouts?.push({
          frame,
          layoutMode: layoutMode as 'HORIZONTAL' | 'VERTICAL',
          itemSpacing,
          padding
        })
      }
      node = frame
      break
    }
    case 'create-rectangle': {
      const rect = figma.createRectangle()
      rect.x = x
      rect.y = y
      rect.resize(width || 100, height || 100)
      if (name) rect.name = name
      if (fill) rect.fills = [{ type: 'SOLID', color: hexToRgb(getHexColor(fill)) }]
      if (stroke) rect.strokes = [{ type: 'SOLID', color: hexToRgb(getHexColor(stroke)) }]
      if (strokeWeight) rect.strokeWeight = strokeWeight
      if (typeof radius === 'number') rect.cornerRadius = radius
      if (typeof opacity === 'number') rect.opacity = opacity
      node = rect
      break
    }
    case 'create-ellipse': {
      const ellipse = figma.createEllipse()
      ellipse.x = x
      ellipse.y = y
      ellipse.resize(width || 100, height || 100)
      if (name) ellipse.name = name
      if (fill) ellipse.fills = [{ type: 'SOLID', color: hexToRgb(getHexColor(fill)) }]
      if (stroke) ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(getHexColor(stroke)) }]
      if (strokeWeight) ellipse.strokeWeight = strokeWeight
      if (typeof opacity === 'number') ellipse.opacity = opacity
      node = ellipse
      break
    }
    case 'create-text': {
      const textNode = figma.createText()
      const family = fontFamily || 'Inter'
      const style = fontStyle || 'Regular'
      await loadFont(family, style)
      textNode.fontName = { family, style }
      textNode.characters = text || ''
      textNode.x = x
      textNode.y = y
      if (name) textNode.name = name
      if (fontSize) textNode.fontSize = fontSize
      if (fill) textNode.fills = [{ type: 'SOLID', color: hexToRgb(getHexColor(fill)) }]
      if (typeof opacity === 'number') textNode.opacity = opacity
      node = textNode
      break
    }
    default:
      return null
  }

  return node
}

// Commands that need access to nodes on other pages
const NEEDS_ALL_PAGES = new Set([
  'get-node-info',
  'get-node-tree',
  'get-node-children',
  'set-parent',
  'clone-node',
  'delete-node',
  'get-pages',
  'set-current-page',
  'get-components',
  'get-styles',
  'export-node',
  'screenshot'
])

let allPagesLoaded = false

async function handleCommand(command: string, args?: unknown): Promise<unknown> {
  switch (command) {
    // ==================== BATCH ====================
    case 'batch': {
      const { commands } = args as {
        commands: Array<{ command: string; args?: Record<string, unknown>; parentRef?: string }>
      }
      const results: Array<{ id: string; name: string }> = []
      const refMap = new Map<string, string>() // ref -> actual node id
      const nodeCache = new Map<string, SceneNode>() // cache created nodes for parent lookups
      const deferredLayouts: Array<{
        frame: FrameNode
        layoutMode: 'HORIZONTAL' | 'VERTICAL'
        itemSpacing?: number
        padding?: { top: number; right: number; bottom: number; left: number }
      }> = []
      const internalAttachments: Array<{ node: SceneNode; parentId: string }> = []
      const externalAttachments: Array<{ node: SceneNode; parentId: string }> = []
      const rootNodes: SceneNode[] = []

      for (const cmd of commands) {
        // Resolve parent reference if needed
        if (cmd.args?.parentRef && refMap.has(cmd.args.parentRef)) {
          cmd.args.parentId = refMap.get(cmd.args.parentRef)
          delete cmd.args.parentRef
        }

        // Use fast path for create commands
        const node = await createNodeFast(cmd.command, cmd.args, nodeCache, deferredLayouts)
        if (node) {
          results.push({ id: node.id, name: node.name })
          nodeCache.set(node.id, node) // cache for child lookups
          if (cmd.args?.ref) {
            refMap.set(cmd.args.ref as string, node.id)
          }

          const parentId = cmd.args?.parentId as string | undefined
          if (parentId) {
            if (nodeCache.has(parentId)) {
              internalAttachments.push({ node, parentId })
            } else {
              externalAttachments.push({ node, parentId })
            }
          } else {
            rootNodes.push(node)
          }
        } else {
          // Fallback to full handler
          const result = (await handleCommand(cmd.command, cmd.args)) as {
            id: string
            name: string
          }
          results.push(result)
          if (cmd.args?.ref) {
            refMap.set(cmd.args.ref as string, result.id)
          }
        }
      }

      for (const attachment of internalAttachments) {
        const parent = nodeCache.get(attachment.parentId)
        if (parent && 'appendChild' in parent) {
          parent.appendChild(attachment.node)
        }
      }

      // Apply layouts in reverse order (children first, then parents)
      for (let i = deferredLayouts.length - 1; i >= 0; i--) {
        const layout = deferredLayouts[i]
        layout.frame.layoutMode = layout.layoutMode
        layout.frame.primaryAxisSizingMode = 'AUTO'
        layout.frame.counterAxisSizingMode = 'AUTO'
        if (layout.itemSpacing) layout.frame.itemSpacing = layout.itemSpacing
        if (layout.padding) {
          layout.frame.paddingTop = layout.padding.top
          layout.frame.paddingRight = layout.padding.right
          layout.frame.paddingBottom = layout.padding.bottom
          layout.frame.paddingLeft = layout.padding.left
        }
      }

      for (const node of rootNodes) {
        figma.currentPage.appendChild(node)
      }

      for (const attachment of externalAttachments) {
        let parent = nodeCache.get(attachment.parentId)
        if (!parent) {
          parent = (await figma.getNodeByIdAsync(attachment.parentId)) as SceneNode | null
        }
        if (parent && 'appendChild' in parent) {
          parent.appendChild(attachment.node)
        }
      }

      figma.commitUndo()

      return results
    }

    // ==================== READ ====================
    case 'get-selection':
      return figma.currentPage.selection.map(serializeNode)

    case 'get-node-info': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      return node ? serializeNode(node) : null
    }

    case 'get-ancestors': {
      const { id, depth = 10 } = args as { id: string; depth?: number }
      let node = await figma.getNodeByIdAsync(id)
      if (!node) throw new Error('Node not found')

      const ancestors: Array<{
        id: string
        name: string
        type: string
        childCount?: number
      }> = []

      let remaining = depth
      while (node && remaining-- > 0) {
        ancestors.push({
          id: node.id,
          name: node.name,
          type: node.type,
          childCount: 'children' in node ? (node as ChildrenMixin).children.length : undefined
        })
        node = node.parent
      }
      return ancestors
    }

    case 'get-node-bindings': {
      const { id } = args as { id: string }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')

      const result: Record<string, unknown> = { id: node.id, name: node.name, type: node.type }

      if ('fills' in node && Array.isArray(node.fills)) {
        const fillBindings: Array<{ index: number; variableId: string; variableName: string }> = []
        for (let i = 0; i < node.fills.length; i++) {
          const fill = node.fills[i]
          if (fill.boundVariables?.color) {
            const varId = fill.boundVariables.color.id
            const variable = await figma.variables.getVariableByIdAsync(varId)
            fillBindings.push({
              index: i,
              variableId: varId,
              variableName: variable?.name || 'unknown'
            })
          }
        }
        if (fillBindings.length > 0) result.fills = fillBindings
      }

      if ('strokes' in node && Array.isArray(node.strokes)) {
        const strokeBindings: Array<{ index: number; variableId: string; variableName: string }> =
          []
        for (let i = 0; i < node.strokes.length; i++) {
          const stroke = node.strokes[i]
          if (stroke.boundVariables?.color) {
            const varId = stroke.boundVariables.color.id
            const variable = await figma.variables.getVariableByIdAsync(varId)
            strokeBindings.push({
              index: i,
              variableId: varId,
              variableName: variable?.name || 'unknown'
            })
          }
        }
        if (strokeBindings.length > 0) result.strokes = strokeBindings
      }

      return result
    }

    case 'get-current-page':
      return { id: figma.currentPage.id, name: figma.currentPage.name }

    case 'get-page-bounds': {
      const children = figma.currentPage.children
      if (children.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, suggestedX: 100 }
      }

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const node of children) {
        if ('x' in node && 'y' in node && 'width' in node && 'height' in node) {
          minX = Math.min(minX, node.x)
          minY = Math.min(minY, node.y)
          maxX = Math.max(maxX, node.x + node.width)
          maxY = Math.max(maxY, node.y + node.height)
        }
      }

      return {
        minX: Math.round(minX),
        minY: Math.round(minY),
        maxX: Math.round(maxX),
        maxY: Math.round(maxY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY),
        suggestedX: Math.ceil(maxX / 100) * 100 + 100
      }
    }

    case 'list-fonts': {
      const fonts = await figma.listAvailableFontsAsync()
      return fonts.map((f) => ({ family: f.fontName.family, style: f.fontName.style }))
    }

    case 'get-node-tree': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node) throw new Error('Node not found')

      const serializeTreeNode = (n: BaseNode): object => {
        const base: Record<string, unknown> = {
          id: n.id,
          name: n.name,
          type: n.type
        }
        if ('x' in n) base.x = Math.round(n.x)
        if ('y' in n) base.y = Math.round(n.y)
        if ('width' in n) base.width = Math.round(n.width)
        if ('height' in n) base.height = Math.round(n.height)

        // Layout sizing for auto-layout children
        if ('layoutSizingHorizontal' in n && n.layoutSizingHorizontal !== 'FIXED') {
          base.layoutSizingHorizontal = n.layoutSizingHorizontal
        }
        if ('layoutSizingVertical' in n && n.layoutSizingVertical !== 'FIXED') {
          base.layoutSizingVertical = n.layoutSizingVertical
        }

        // Only essential properties for tree view (skip invisible fills/strokes)
        if ('fills' in n && Array.isArray(n.fills)) {
          const solid = n.fills.find((f: Paint) => f.type === 'SOLID' && f.visible !== false) as
            | SolidPaint
            | undefined
          if (solid) base.fills = [{ type: 'SOLID', color: rgbToHex(solid.color) }]
        }
        if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length > 0) {
          const solid = n.strokes.find((s: Paint) => s.type === 'SOLID' && s.visible !== false) as
            | SolidPaint
            | undefined
          if (solid) base.strokes = [{ type: 'SOLID', color: rgbToHex(solid.color) }]
        }
        if ('strokeWeight' in n && typeof n.strokeWeight === 'number' && n.strokeWeight > 0) {
          base.strokeWeight = n.strokeWeight
        }
        // Stroke align (only if not default CENTER)
        if ('strokeAlign' in n && n.strokeAlign !== 'CENTER') {
          base.strokeAlign = n.strokeAlign
        }
        // Individual stroke weights (if different from strokeWeight)
        if ('strokeTopWeight' in n) {
          const sw = n.strokeWeight as number
          if (n.strokeTopWeight !== sw) base.strokeTopWeight = n.strokeTopWeight
          if ((n as FrameNode).strokeBottomWeight !== sw)
            base.strokeBottomWeight = (n as FrameNode).strokeBottomWeight
          if ((n as FrameNode).strokeLeftWeight !== sw)
            base.strokeLeftWeight = (n as FrameNode).strokeLeftWeight
          if ((n as FrameNode).strokeRightWeight !== sw)
            base.strokeRightWeight = (n as FrameNode).strokeRightWeight
        }
        if ('cornerRadius' in n && typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
          base.cornerRadius = n.cornerRadius
        }
        // Corner smoothing (iOS squircle style)
        if (
          'cornerSmoothing' in n &&
          typeof n.cornerSmoothing === 'number' &&
          n.cornerSmoothing > 0
        ) {
          base.cornerSmoothing = n.cornerSmoothing
        }
        // Individual corner radii (if different from cornerRadius)
        if ('topLeftRadius' in n) {
          const cr = n.cornerRadius as number
          const frame = n as FrameNode
          if (
            frame.topLeftRadius !== cr ||
            frame.topRightRadius !== cr ||
            frame.bottomLeftRadius !== cr ||
            frame.bottomRightRadius !== cr
          ) {
            base.topLeftRadius = frame.topLeftRadius
            base.topRightRadius = frame.topRightRadius
            base.bottomLeftRadius = frame.bottomLeftRadius
            base.bottomRightRadius = frame.bottomRightRadius
          }
        }
        if ('opacity' in n && n.opacity !== 1) base.opacity = n.opacity
        // Blend mode (only if not default)
        if ('blendMode' in n && n.blendMode !== 'PASS_THROUGH' && n.blendMode !== 'NORMAL') {
          base.blendMode = n.blendMode
        }
        if ('visible' in n && !n.visible) base.visible = false
        if ('locked' in n && n.locked) base.locked = true
        // Rotation
        if ('rotation' in n && n.rotation !== 0) {
          base.rotation = Math.round(n.rotation * 100) / 100
        }
        // Clips content (overflow hidden)
        if ('clipsContent' in n && n.clipsContent) {
          base.clipsContent = true
        }
        // Effects (shadows, blur)
        if ('effects' in n && Array.isArray(n.effects) && n.effects.length > 0) {
          const visibleEffects = n.effects.filter((e: Effect) => e.visible !== false)
          if (visibleEffects.length > 0) {
            base.effects = visibleEffects.map((e: Effect) => {
              const effect: Record<string, unknown> = { type: e.type }
              if ('radius' in e) effect.radius = e.radius
              if ('color' in e && e.color) {
                effect.color = rgbToHex(e.color)
                if (e.color.a !== 1) effect.opacity = Math.round(e.color.a * 100) / 100
              }
              if ('offset' in e && e.offset) {
                effect.offset = { x: e.offset.x, y: e.offset.y }
              }
              if ('spread' in e) effect.spread = e.spread
              return effect
            })
          }
        }
        if ('layoutMode' in n && n.layoutMode !== 'NONE') {
          base.layoutMode = n.layoutMode
          if ('itemSpacing' in n) base.itemSpacing = n.itemSpacing
          // Layout wrap (flex-wrap)
          if ('layoutWrap' in n && n.layoutWrap === 'WRAP') {
            base.layoutWrap = 'WRAP'
          }
          if ('paddingTop' in n) {
            base.padding = {
              top: n.paddingTop,
              right: n.paddingRight,
              bottom: n.paddingBottom,
              left: n.paddingLeft
            }
          }
          // Alignment
          if ('primaryAxisAlignItems' in n && n.primaryAxisAlignItems !== 'MIN') {
            base.primaryAxisAlignItems = n.primaryAxisAlignItems
          }
          if ('counterAxisAlignItems' in n && n.counterAxisAlignItems !== 'MIN') {
            base.counterAxisAlignItems = n.counterAxisAlignItems
          }
        }
        // Layout positioning (absolute)
        if ('layoutPositioning' in n && n.layoutPositioning === 'ABSOLUTE') {
          base.layoutPositioning = 'ABSOLUTE'
        }
        // Layout grow (flex-grow)
        if ('layoutGrow' in n && n.layoutGrow > 0) {
          base.layoutGrow = n.layoutGrow
        }
        // Layout align (stretch)
        if ('layoutAlign' in n && n.layoutAlign === 'STRETCH') {
          base.layoutAlign = 'STRETCH'
        }
        // Min/max constraints
        if ('minWidth' in n && n.minWidth !== null) base.minWidth = n.minWidth
        if ('maxWidth' in n && n.maxWidth !== null) base.maxWidth = n.maxWidth
        if ('minHeight' in n && n.minHeight !== null) base.minHeight = n.minHeight
        if ('maxHeight' in n && n.maxHeight !== null) base.maxHeight = n.maxHeight
        if (n.type === 'TEXT') {
          const t = n as TextNode
          base.characters = t.characters
          if (typeof t.fontSize === 'number') base.fontSize = t.fontSize
          base.textAutoResize = t.textAutoResize
          if (typeof t.fontName === 'object') {
            base.fontFamily = t.fontName.family
            base.fontStyle = t.fontName.style
            // Map font style to weight
            const styleToWeight: Record<string, number> = {
              Thin: 100,
              Hairline: 100,
              ExtraLight: 200,
              UltraLight: 200,
              Light: 300,
              Regular: 400,
              Normal: 400,
              Medium: 500,
              SemiBold: 600,
              DemiBold: 600,
              Bold: 700,
              ExtraBold: 800,
              UltraBold: 800,
              Black: 900,
              Heavy: 900
            }
            const weight = styleToWeight[t.fontName.style] || 400
            if (weight !== 400) base.fontWeight = weight
          }
          // Export component property references for text
          if (t.componentPropertyReferences?.characters) {
            base.textPropertyRef = t.componentPropertyReferences.characters
          }
        }

        if ('children' in n && (n as FrameNode).children) {
          base.children = (n as FrameNode).children.map(serializeTreeNode)
        }
        return base
      }
      return serializeTreeNode(node)
    }

    case 'get-fonts': {
      const fonts = new Map<string, Set<string>>()

      const collectFonts = (node: SceneNode) => {
        if (node.type === 'TEXT') {
          const textNode = node as TextNode
          if (typeof textNode.fontName === 'object') {
            const family = textNode.fontName.family
            if (!fonts.has(family)) {
              fonts.set(family, new Set())
            }
            fonts.get(family)!.add(textNode.fontName.style)
          }
        }
        if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            collectFonts(child)
          }
        }
      }

      for (const node of figma.currentPage.children) {
        collectFonts(node)
      }

      return Array.from(fonts.entries()).map(([family, styles]) => ({
        family,
        styles: Array.from(styles).sort()
      }))
    }

    case 'get-all-components': {
      const {
        name,
        limit = 50,
        page
      } = (args as { name?: string; limit?: number; page?: string }) || {}
      const components: object[] = []
      const nameLower = name?.toLowerCase()

      const searchNode = (node: SceneNode, parentSetId?: string): boolean => {
        if (components.length >= limit) return false
        if (node.type === 'COMPONENT_SET') {
          if (!nameLower || node.name.toLowerCase().includes(nameLower)) {
            // Add component set itself
            components.push({ ...serializeNode(node), componentSetId: node.id })
          }
          // Search children with reference to parent set
          for (const child of node.children) {
            if (!searchNode(child, node.id)) return false
          }
        } else if (node.type === 'COMPONENT') {
          if (!nameLower || node.name.toLowerCase().includes(nameLower)) {
            components.push({ ...serializeNode(node), componentSetId: parentSetId })
          }
        } else if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            if (!searchNode(child)) return false
          }
        }
        return components.length < limit
      }

      const pages = page
        ? figma.root.children.filter(
            (p) => p.id === page || p.name === page || p.name.includes(page)
          )
        : figma.root.children

      for (const pageNode of pages) {
        if (components.length >= limit) break
        for (const child of pageNode.children) {
          if (!searchNode(child)) break
        }
      }
      return components
    }

    case 'combine-as-variants': {
      const { ids, name } = args as { ids: string[]; name?: string }
      const nodes: ComponentNode[] = []
      for (const id of ids) {
        const node = await figma.getNodeByIdAsync(id)
        if (!node || node.type !== 'COMPONENT') {
          throw new Error(`Node ${id} is not a component`)
        }
        nodes.push(node)
      }
      if (nodes.length < 2) {
        throw new Error('Need at least 2 components to combine')
      }
      const componentSet = figma.combineAsVariants(nodes, figma.currentPage)
      if (name) componentSet.name = name
      return serializeNode(componentSet)
    }

    case 'get-pages':
      return figma.root.children.map((page) => ({ id: page.id, name: page.name }))

    case 'create-page': {
      const { name } = args as { name: string }
      const page = figma.createPage()
      page.name = name
      return { id: page.id, name: page.name }
    }

    case 'set-current-page': {
      const { page: pageArg } = args as { page: string }
      let page: PageNode | null = null

      // Try by ID first
      const byId = (await figma.getNodeByIdAsync(pageArg)) as PageNode | null
      if (byId && byId.type === 'PAGE') {
        page = byId
      } else {
        // Try by name
        page =
          figma.root.children.find((p) => p.name === pageArg || p.name.includes(pageArg)) || null
      }

      if (!page) throw new Error('Page not found')
      await figma.setCurrentPageAsync(page)
      return { id: page.id, name: page.name }
    }

    case 'get-local-styles': {
      const { type } = (args as { type?: string }) || {}
      const result: Record<string, object[]> = {}
      if (!type || type === 'all' || type === 'paint') {
        const styles = await figma.getLocalPaintStylesAsync()
        if (styles.length > 0) {
          result.paintStyles = styles.map((s) => ({
            id: s.id,
            name: s.name,
            paints: s.paints.map(serializePaint)
          }))
        }
      }
      if (!type || type === 'all' || type === 'text') {
        const styles = await figma.getLocalTextStylesAsync()
        if (styles.length > 0) {
          result.textStyles = styles.map((s) => ({
            id: s.id,
            name: s.name,
            fontSize: s.fontSize,
            fontFamily: s.fontName.family,
            fontStyle: s.fontName.style
          }))
        }
      }
      if (!type || type === 'all' || type === 'effect') {
        const styles = await figma.getLocalEffectStylesAsync()
        if (styles.length > 0) {
          result.effectStyles = styles.map((s) => ({
            id: s.id,
            name: s.name,
            effects: s.effects.map((e) => ({
              type: e.type,
              radius: 'radius' in e ? e.radius : undefined
            }))
          }))
        }
      }
      if (!type || type === 'all' || type === 'grid') {
        const styles = await figma.getLocalGridStylesAsync()
        if (styles.length > 0) {
          result.gridStyles = styles.map((s) => ({
            id: s.id,
            name: s.name,
            grids: s.layoutGrids.length
          }))
        }
      }
      return result
    }

    case 'get-viewport':
      return {
        center: figma.viewport.center,
        zoom: figma.viewport.zoom,
        bounds: figma.viewport.bounds
      }

    // ==================== CREATE SHAPES ====================
    case 'create-rectangle': {
      const { x, y, width, height, name, parentId, fill, stroke, strokeWeight, radius, opacity } =
        args as {
          x: number
          y: number
          width: number
          height: number
          name?: string
          parentId?: string
          fill?: string
          stroke?: string
          strokeWeight?: number
          radius?: number
          opacity?: number
        }
      const rect = figma.createRectangle()
      rect.x = x
      rect.y = y
      rect.resize(width, height)
      if (name) rect.name = name
      if (fill) rect.fills = [await createSolidPaint(fill)]
      if (stroke) rect.strokes = [await createSolidPaint(stroke)]
      if (strokeWeight !== undefined) rect.strokeWeight = strokeWeight
      if (radius !== undefined) rect.cornerRadius = radius
      if (opacity !== undefined) rect.opacity = opacity
      await appendToParent(rect, parentId)
      return serializeNode(rect)
    }

    case 'create-ellipse': {
      const { x, y, width, height, name, parentId, fill, stroke, strokeWeight, opacity } = args as {
        x: number
        y: number
        width: number
        height: number
        name?: string
        parentId?: string
        fill?: string
        stroke?: string
        strokeWeight?: number
        opacity?: number
      }
      const ellipse = figma.createEllipse()
      ellipse.x = x
      ellipse.y = y
      ellipse.resize(width, height)
      if (name) ellipse.name = name
      if (fill) ellipse.fills = [await createSolidPaint(fill)]
      if (stroke) ellipse.strokes = [await createSolidPaint(stroke)]
      if (strokeWeight !== undefined) ellipse.strokeWeight = strokeWeight
      if (opacity !== undefined) ellipse.opacity = opacity
      await appendToParent(ellipse, parentId)
      return serializeNode(ellipse)
    }

    case 'create-line': {
      const { x, y, length, rotation, name, parentId, stroke, strokeWeight } = args as {
        x: number
        y: number
        length: number
        rotation?: number
        name?: string
        parentId?: string
        stroke?: string
        strokeWeight?: number
      }
      const line = figma.createLine()
      line.x = x
      line.y = y
      line.resize(length, 0)
      if (rotation) line.rotation = rotation
      if (name) line.name = name
      if (stroke) line.strokes = [await createSolidPaint(stroke)]
      if (strokeWeight !== undefined) line.strokeWeight = strokeWeight
      await appendToParent(line, parentId)
      return serializeNode(line)
    }

    case 'create-polygon': {
      const { x, y, size, sides, name, parentId } = args as {
        x: number
        y: number
        size: number
        sides?: number
        name?: string
        parentId?: string
      }
      const polygon = figma.createPolygon()
      polygon.x = x
      polygon.y = y
      polygon.resize(size, size)
      if (sides) polygon.pointCount = sides
      if (name) polygon.name = name
      await appendToParent(polygon, parentId)
      return serializeNode(polygon)
    }

    case 'create-star': {
      const { x, y, size, points, innerRadius, name, parentId } = args as {
        x: number
        y: number
        size: number
        points?: number
        innerRadius?: number
        name?: string
        parentId?: string
      }
      const star = figma.createStar()
      star.x = x
      star.y = y
      star.resize(size, size)
      if (points) star.pointCount = points
      if (innerRadius !== undefined) star.innerRadius = innerRadius
      if (name) star.name = name
      await appendToParent(star, parentId)
      return serializeNode(star)
    }

    case 'create-vector': {
      const { x, y, path, name, parentId } = args as {
        x: number
        y: number
        path: string
        name?: string
        parentId?: string
      }
      const frame = figma.createNodeFromSvg(`<svg><path d="${path}"/></svg>`)
      frame.x = x
      frame.y = y
      if (name) frame.name = name
      await appendToParent(frame, parentId)
      return serializeNode(frame)
    }

    // ==================== CREATE CONTAINERS ====================
    case 'create-frame': {
      const {
        x,
        y,
        width,
        height,
        name,
        parentId,
        fill,
        stroke,
        strokeWeight,
        radius,
        opacity,
        layoutMode,
        itemSpacing,
        padding
      } = args as {
        x: number
        y: number
        width: number
        height: number
        name?: string
        parentId?: string
        fill?: string
        stroke?: string
        strokeWeight?: number
        radius?: number
        opacity?: number
        layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE'
        itemSpacing?: number
        padding?: { top: number; right: number; bottom: number; left: number }
      }
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(width, height)
      if (name) frame.name = name
      if (fill) frame.fills = [await createSolidPaint(fill)]
      if (stroke) frame.strokes = [await createSolidPaint(stroke)]
      if (strokeWeight !== undefined) frame.strokeWeight = strokeWeight
      if (radius !== undefined) frame.cornerRadius = radius
      if (opacity !== undefined) frame.opacity = opacity
      if (layoutMode && layoutMode !== 'NONE') {
        frame.layoutMode = layoutMode
        if (itemSpacing !== undefined) frame.itemSpacing = itemSpacing
        if (padding) {
          frame.paddingTop = padding.top
          frame.paddingRight = padding.right
          frame.paddingBottom = padding.bottom
          frame.paddingLeft = padding.left
        }
      }
      await appendToParent(frame, parentId)
      return serializeNode(frame)
    }

    case 'create-section': {
      const { x, y, width, height, name } = args as {
        x: number
        y: number
        width: number
        height: number
        name?: string
      }
      const section = figma.createSection()
      section.x = x
      section.y = y
      section.resizeWithoutConstraints(width, height)
      if (name) section.name = name
      return serializeNode(section)
    }

    case 'create-slice': {
      const { x, y, width, height, name } = args as {
        x: number
        y: number
        width: number
        height: number
        name?: string
      }
      const slice = figma.createSlice()
      slice.x = x
      slice.y = y
      slice.resize(width, height)
      if (name) slice.name = name
      return serializeNode(slice)
    }

    // ==================== CREATE OTHER ====================
    case 'create-text': {
      const { x, y, text, fontSize, fontFamily, fontStyle, fill, opacity, name, parentId } =
        args as {
          x: number
          y: number
          text: string
          fontSize?: number
          fontFamily?: string
          fontStyle?: string
          fill?: string
          opacity?: number
          name?: string
          parentId?: string
        }
      const textNode = figma.createText()
      const family = fontFamily || 'Inter'
      const style = fontStyle || 'Regular'
      await loadFont(family, style)
      textNode.x = x
      textNode.y = y
      textNode.fontName = { family, style }
      textNode.characters = text
      if (fontSize) textNode.fontSize = fontSize
      if (fill) textNode.fills = [await createSolidPaint(fill)]
      if (opacity !== undefined) textNode.opacity = opacity
      if (name) textNode.name = name
      await appendToParent(textNode, parentId)
      return serializeNode(textNode)
    }

    case 'create-instance': {
      const { componentId, x, y, name, parentId } = args as {
        componentId: string
        x?: number
        y?: number
        name?: string
        parentId?: string
      }
      const component = (await figma.getNodeByIdAsync(componentId)) as ComponentNode | null
      if (!component || component.type !== 'COMPONENT') throw new Error('Component not found')
      const instance = component.createInstance()
      if (x !== undefined) instance.x = x
      if (y !== undefined) instance.y = y
      if (name) instance.name = name
      await appendToParent(instance, parentId)
      return serializeNode(instance)
    }

    case 'create-component': {
      const { name, parentId, x, y, width, height, fill } = args as {
        name: string
        parentId?: string
        x?: number
        y?: number
        width?: number
        height?: number
        fill?: string
      }
      const component = figma.createComponent()
      component.name = name
      if (x !== undefined) component.x = x
      if (y !== undefined) component.y = y
      if (width && height) component.resize(width, height)
      if (fill) component.fills = [await createSolidPaint(fill)]
      await appendToParent(component, parentId)
      return serializeNode(component)
    }

    case 'clone-node': {
      const { ids, id } = args as { ids?: string[]; id?: string }
      const nodeIds = ids ?? (id ? [id] : [])
      if (nodeIds.length === 0) throw new Error('No node IDs provided')

      const clones = []
      for (const nodeId of nodeIds) {
        const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null
        if (node && 'clone' in node) {
          const clone = node.clone()
          clones.push(serializeNode(clone))
        }
      }
      return clones.length === 1 ? clones[0] : clones
    }

    case 'replace-node-with': {
      const { targetId, sourceId } = args as { targetId: string; sourceId: string }
      const target = (await figma.getNodeByIdAsync(targetId)) as SceneNode | null
      const source = (await figma.getNodeByIdAsync(sourceId)) as SceneNode | null

      if (!target) throw new Error('Target node not found')
      if (!source) throw new Error('Source node not found')

      const parent = target.parent
      if (!parent || !('children' in parent)) throw new Error('Target has no valid parent')

      const index = parent.children.indexOf(target)
      const x = target.x
      const y = target.y

      // Create replacement: instance if component, clone otherwise
      let replacement: SceneNode
      if (source.type === 'COMPONENT') {
        replacement = (source as ComponentNode).createInstance()
      } else {
        replacement = source.clone()
      }

      // Insert at same position
      parent.insertChild(index, replacement)
      replacement.x = x
      replacement.y = y

      // Remove original target
      target.remove()

      // If source was a temp render (not a component), remove it too
      if (source.type !== 'COMPONENT' && source.parent) {
        source.remove()
      }

      return serializeNode(replacement)
    }

    case 'convert-to-component': {
      const { id } = args as { id: string }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      const component = figma.createComponentFromNode(node)
      return serializeNode(component)
    }

    // ==================== CREATE STYLES ====================
    case 'create-paint-style': {
      const { name, color } = args as { name: string; color: string }
      const style = figma.createPaintStyle()
      style.name = name
      style.paints = [await createSolidPaint(color)]
      return { id: style.id, name: style.name, key: style.key }
    }

    case 'create-text-style': {
      const { name, fontFamily, fontStyle, fontSize } = args as {
        name: string
        fontFamily?: string
        fontStyle?: string
        fontSize?: number
      }
      const style = figma.createTextStyle()
      style.name = name
      await loadFont(fontFamily || 'Inter', fontStyle || 'Regular')
      style.fontName = { family: fontFamily || 'Inter', style: fontStyle || 'Regular' }
      if (fontSize) style.fontSize = fontSize
      return { id: style.id, name: style.name, key: style.key }
    }

    case 'create-effect-style': {
      const { name, type, radius, color, offsetX, offsetY } = args as {
        name: string
        type: string
        radius?: number
        color?: string
        offsetX?: number
        offsetY?: number
      }
      const style = figma.createEffectStyle()
      style.name = name
      const rgba = color ? hexToRgba(color) : { r: 0, g: 0, b: 0, a: 0.25 }
      if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
        style.effects = [
          {
            type: type as 'DROP_SHADOW' | 'INNER_SHADOW',
            color: rgba,
            offset: { x: offsetX || 0, y: offsetY || 4 },
            radius: radius || 10,
            spread: 0,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      } else if (type === 'BLUR' || type === 'BACKGROUND_BLUR') {
        style.effects = [
          {
            type: type as 'LAYER_BLUR' | 'BACKGROUND_BLUR',
            blurType: 'NORMAL',
            radius: radius || 10,
            visible: true
          } as BlurEffect
        ]
      }
      return { id: style.id, name: style.name, key: style.key }
    }

    // ==================== UPDATE POSITION/SIZE ====================
    case 'move-node': {
      const { id, x, y } = args as { id: string; x: number; y: number }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.x = x
      node.y = y
      return serializeNode(node)
    }

    case 'resize-node': {
      const { id, width, height } = args as { id: string; width: number; height: number }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if ('resize' in node) {
        node.resize(width, height)
      } else if ('width' in node && 'height' in node) {
        ;(node as SectionNode).resizeWithoutConstraints(width, height)
      } else {
        throw new Error('Node cannot be resized')
      }
      return serializeNode(node)
    }

    // ==================== UPDATE APPEARANCE ====================
    case 'set-fill-color': {
      const { id, color } = args as { id: string; color: string }
      const node = (await figma.getNodeByIdAsync(id)) as GeometryMixin | null
      if (!node || !('fills' in node)) throw new Error('Node not found')
      node.fills = [await createSolidPaint(color)]
      return serializeNode(node as BaseNode)
    }

    case 'set-stroke-color': {
      const { id, color, weight, align } = args as {
        id: string
        color: string
        weight?: number
        align?: string
      }
      const node = (await figma.getNodeByIdAsync(id)) as GeometryMixin | null
      if (!node || !('strokes' in node)) throw new Error('Node not found')
      node.strokes = [await createSolidPaint(color)]
      if (weight !== undefined && 'strokeWeight' in node) (node as any).strokeWeight = weight
      if (align && 'strokeAlign' in node)
        (node as any).strokeAlign = align as 'INSIDE' | 'OUTSIDE' | 'CENTER'
      return serializeNode(node as BaseNode)
    }

    case 'set-corner-radius': {
      const {
        id,
        cornerRadius,
        topLeftRadius,
        topRightRadius,
        bottomLeftRadius,
        bottomRightRadius
      } = args as {
        id: string
        cornerRadius: number
        topLeftRadius?: number
        topRightRadius?: number
        bottomLeftRadius?: number
        bottomRightRadius?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as RectangleNode | null
      if (!node || !('cornerRadius' in node)) throw new Error('Node not found')
      node.cornerRadius = cornerRadius
      if (topLeftRadius !== undefined) node.topLeftRadius = topLeftRadius
      if (topRightRadius !== undefined) node.topRightRadius = topRightRadius
      if (bottomLeftRadius !== undefined) node.bottomLeftRadius = bottomLeftRadius
      if (bottomRightRadius !== undefined) node.bottomRightRadius = bottomRightRadius
      return serializeNode(node)
    }

    case 'set-opacity': {
      const { id, opacity } = args as { id: string; opacity: number }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node || !('opacity' in node)) throw new Error('Node not found')
      node.opacity = opacity
      return serializeNode(node)
    }

    case 'set-image-fill': {
      const { id, url, scaleMode } = args as { id: string; url: string; scaleMode?: string }
      const node = (await figma.getNodeByIdAsync(id)) as GeometryMixin | null
      if (!node || !('fills' in node)) throw new Error('Node not found')
      const image = await figma.createImageAsync(url)
      node.fills = [
        {
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: (scaleMode || 'FILL') as 'FILL' | 'FIT' | 'CROP' | 'TILE'
        }
      ]
      return serializeNode(node as BaseNode)
    }

    // ==================== UPDATE PROPERTIES ====================
    case 'rename-node': {
      const { id, name } = args as { id: string; name: string }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.name = name
      return serializeNode(node)
    }

    case 'bind-fill-variable-by-name': {
      const { id, variableName, recursive } = args as {
        id: string
        variableName: string
        recursive?: boolean
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')

      const variables = await figma.variables.getLocalVariablesAsync('COLOR')
      const variable = variables.find((v) => v.name === variableName)
      if (!variable) throw new Error(`Variable "${variableName}" not found`)

      function bindFills(n: SceneNode) {
        if ('fills' in n && Array.isArray(n.fills) && n.fills.length > 0) {
          const fills = [...n.fills] as Paint[]
          for (let i = 0; i < fills.length; i++) {
            if (fills[i].type === 'SOLID') {
              fills[i] = figma.variables.setBoundVariableForPaint(fills[i], 'color', variable)
            }
          }
          ;(n as GeometryMixin).fills = fills
        }
        if (recursive && 'children' in n) {
          for (const child of (n as ChildrenMixin).children) {
            bindFills(child as SceneNode)
          }
        }
      }

      bindFills(node)
      return serializeNode(node)
    }

    case 'set-visible': {
      const { id, visible } = args as { id: string; visible: boolean }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.visible = visible
      return serializeNode(node)
    }

    case 'set-locked': {
      const { id, locked } = args as { id: string; locked: boolean }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.locked = locked
      return serializeNode(node)
    }

    case 'set-effect': {
      const { id, type, color, offsetX, offsetY, radius, spread } = args as {
        id: string
        type: string
        color?: string
        offsetX?: number
        offsetY?: number
        radius?: number
        spread?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node || !('effects' in node)) throw new Error('Node not found')
      const rgba = color ? hexToRgba(color) : { r: 0, g: 0, b: 0, a: 0.25 }
      if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
        node.effects = [
          {
            type: type as 'DROP_SHADOW' | 'INNER_SHADOW',
            color: rgba,
            offset: { x: offsetX ?? 0, y: offsetY ?? 4 },
            radius: radius ?? 8,
            spread: spread ?? 0,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      } else if (type === 'BLUR') {
        node.effects = [
          {
            type: 'LAYER_BLUR',
            blurType: 'NORMAL',
            radius: radius ?? 8,
            visible: true
          } as BlurEffect
        ]
      }
      return serializeNode(node)
    }

    case 'set-text': {
      const { id, text } = args as { id: string; text: string }
      const node = (await figma.getNodeByIdAsync(id)) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      const fontName = node.fontName as FontName
      await loadFont(fontName.family, fontName.style)
      node.characters = text
      return serializeNode(node)
    }

    case 'set-text-auto-resize': {
      const { id, mode } = args as {
        id: string
        mode: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE'
      }
      const node = (await figma.getNodeByIdAsync(id)) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      const fontName = node.fontName as FontName
      await loadFont(fontName.family, fontName.style)
      node.textAutoResize = mode
      return serializeNode(node)
    }

    case 'import-svg': {
      const { svg, x, y, name, parentId, noFill, insertIndex } = args as {
        svg: string
        x?: number
        y?: number
        name?: string
        parentId?: string
        noFill?: boolean
        insertIndex?: number
      }
      const node = figma.createNodeFromSvg(svg)
      if (x !== undefined) node.x = x
      if (y !== undefined) node.y = y
      if (name) node.name = name
      if (noFill) node.fills = []
      await appendToParent(node, parentId, insertIndex)
      return serializeNode(node)
    }

    case 'set-font': {
      const { id, fontFamily, fontStyle, fontSize } = args as {
        id: string
        fontFamily?: string
        fontStyle?: string
        fontSize?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      const currentFont = node.fontName as FontName
      const family = fontFamily || currentFont.family
      const style = fontStyle || currentFont.style
      await loadFont(family, style)
      node.fontName = { family, style }
      if (fontSize !== undefined) node.fontSize = fontSize
      return serializeNode(node)
    }

    case 'set-font-range': {
      const { id, start, end, family, style, size, color } = args as {
        id: string
        start: number
        end: number
        family?: string
        style?: string
        size?: number
        color?: string
      }
      const node = (await figma.getNodeByIdAsync(id)) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')

      if (family || style) {
        const currentFont = node.getRangeFontName(start, end) as FontName
        const newFamily = family || currentFont.family
        const newStyle = style || currentFont.style
        await loadFont(newFamily, newStyle)
        node.setRangeFontName(start, end, { family: newFamily, style: newStyle })
      }

      if (size !== undefined) {
        node.setRangeFontSize(start, end, size)
      }

      if (color) {
        node.setRangeFills(start, end, [await createSolidPaint(color)])
      }

      return serializeNode(node)
    }

    case 'get-children': {
      const { id, depth } = args as { id: string; depth?: number }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('children' in node)) return []
      const maxDepth = depth || 1
      const serializeWithDepth = (n: SceneNode, d: number): object => {
        const base = serializeNode(n) as Record<string, unknown>
        if (d < maxDepth && 'children' in n) {
          base.children = (n as FrameNode).children.map((c) => serializeWithDepth(c, d + 1))
        }
        return base
      }
      return (node as FrameNode).children.map((c) => serializeWithDepth(c, 1))
    }

    case 'find-by-name': {
      const {
        name,
        type,
        exact,
        limit = 100
      } = args as { name?: string; type?: string; exact?: boolean; limit?: number }
      const results: object[] = []
      const nameLower = name?.toLowerCase()

      const searchNode = (node: SceneNode): boolean => {
        if (results.length >= limit) return false
        const nameMatch =
          !nameLower || (exact ? node.name === name : node.name.toLowerCase().includes(nameLower))
        const typeMatch = !type || node.type === type
        if (nameMatch && typeMatch) results.push(serializeNode(node))
        if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            if (!searchNode(child)) return false
          }
        }
        return results.length < limit
      }

      for (const child of figma.currentPage.children) {
        if (!searchNode(child)) break
      }
      return results
    }

    case 'select-nodes': {
      const { ids } = args as { ids: string[] }
      const nodes = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'id' in n)
      figma.currentPage.selection = validNodes
      return { selected: validNodes.length }
    }

    case 'set-constraints': {
      const { id, horizontal, vertical } = args as {
        id: string
        horizontal?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
        vertical?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node || !('constraints' in node)) throw new Error('Node not found')
      node.constraints = {
        horizontal: horizontal || node.constraints.horizontal,
        vertical: vertical || node.constraints.vertical
      }
      return serializeNode(node)
    }

    case 'set-blend-mode': {
      const { id, mode } = args as { id: string; mode: BlendMode }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node || !('blendMode' in node)) throw new Error('Node not found')
      node.blendMode = mode
      return serializeNode(node)
    }

    case 'set-auto-layout': {
      const {
        id,
        mode,
        wrap,
        itemSpacing,
        counterSpacing,
        padding,
        primaryAlign,
        counterAlign,
        sizingH,
        sizingV,
        gridColumnSizes,
        gridRowSizes,
        gridColumnGap,
        gridRowGap
      } = args as {
        id: string
        mode?: 'HORIZONTAL' | 'VERTICAL' | 'GRID' | 'NONE'
        wrap?: boolean
        itemSpacing?: number
        counterSpacing?: number
        padding?: { top: number; right: number; bottom: number; left: number }
        primaryAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
        counterAlign?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
        sizingH?: 'FIXED' | 'HUG' | 'FILL'
        sizingV?: 'FIXED' | 'HUG' | 'FILL'
        gridColumnSizes?: Array<{ type: 'FIXED' | 'FLEX' | 'HUG'; value?: number }>
        gridRowSizes?: Array<{ type: 'FIXED' | 'FLEX' | 'HUG'; value?: number }>
        gridColumnGap?: number
        gridRowGap?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as FrameNode | null
      if (!node || !('layoutMode' in node)) throw new Error('Frame not found')
      if (mode) node.layoutMode = mode
      if (wrap !== undefined) node.layoutWrap = wrap ? 'WRAP' : 'NO_WRAP'
      if (itemSpacing !== undefined) node.itemSpacing = itemSpacing
      if (counterSpacing !== undefined) node.counterAxisSpacing = counterSpacing
      if (padding) {
        node.paddingTop = padding.top
        node.paddingRight = padding.right
        node.paddingBottom = padding.bottom
        node.paddingLeft = padding.left
      }
      if (primaryAlign) node.primaryAxisAlignItems = primaryAlign
      if (counterAlign) node.counterAxisAlignItems = counterAlign
      if (sizingH) node.layoutSizingHorizontal = sizingH
      if (sizingV) node.layoutSizingVertical = sizingV
      if (gridColumnSizes) {
        node.gridColumnCount = gridColumnSizes.length
        node.gridColumnSizes = gridColumnSizes
      }
      if (gridRowSizes) {
        node.gridRowCount = gridRowSizes.length
        node.gridRowSizes = gridRowSizes
      }
      if (gridColumnGap !== undefined) node.gridColumnGap = gridColumnGap
      if (gridRowGap !== undefined) node.gridRowGap = gridRowGap
      return serializeNode(node)
    }

    case 'set-layout-child': {
      const { id, horizontalSizing, verticalSizing, positioning, x, y } = args as {
        id: string
        horizontalSizing?: 'FIXED' | 'FILL' | 'HUG'
        verticalSizing?: 'FIXED' | 'FILL' | 'HUG'
        positioning?: 'AUTO' | 'ABSOLUTE'
        x?: number
        y?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (horizontalSizing && 'layoutSizingHorizontal' in node) {
        ;(node as FrameNode).layoutSizingHorizontal = horizontalSizing
      }
      if (verticalSizing && 'layoutSizingVertical' in node) {
        ;(node as FrameNode).layoutSizingVertical = verticalSizing
      }
      if (positioning && 'layoutPositioning' in node) {
        ;(node as FrameNode).layoutPositioning = positioning
      }
      if (positioning === 'ABSOLUTE') {
        if (x !== undefined) node.x = x
        if (y !== undefined) node.y = y
      }
      return serializeNode(node)
    }

    case 'set-text-properties': {
      const {
        id,
        lineHeight,
        letterSpacing,
        textAlign,
        verticalAlign,
        autoResize,
        maxLines,
        paragraphSpacing,
        paragraphIndent
      } = args as {
        id: string
        lineHeight?: number | 'auto'
        letterSpacing?: number
        textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
        verticalAlign?: 'TOP' | 'CENTER' | 'BOTTOM'
        autoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE'
        maxLines?: number
        paragraphSpacing?: number
        paragraphIndent?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')

      const fontName = node.fontName as FontName
      await loadFont(fontName.family, fontName.style)

      if (lineHeight !== undefined) {
        node.lineHeight =
          lineHeight === 'auto' ? { unit: 'AUTO' } : { unit: 'PIXELS', value: lineHeight }
      }
      if (letterSpacing !== undefined) {
        node.letterSpacing = { unit: 'PIXELS', value: letterSpacing }
      }
      if (textAlign) node.textAlignHorizontal = textAlign
      if (verticalAlign) node.textAlignVertical = verticalAlign
      if (autoResize) node.textAutoResize = autoResize
      if (maxLines !== undefined) node.maxLines = maxLines
      if (paragraphSpacing !== undefined) node.paragraphSpacing = paragraphSpacing
      if (paragraphIndent !== undefined) node.paragraphIndent = paragraphIndent
      return serializeNode(node)
    }

    case 'set-min-max': {
      const { id, minWidth, maxWidth, minHeight, maxHeight } = args as {
        id: string
        minWidth?: number
        maxWidth?: number
        minHeight?: number
        maxHeight?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as FrameNode | null
      if (!node) throw new Error('Node not found')
      if (minWidth !== undefined && 'minWidth' in node) node.minWidth = minWidth
      if (maxWidth !== undefined && 'maxWidth' in node) node.maxWidth = maxWidth
      if (minHeight !== undefined && 'minHeight' in node) node.minHeight = minHeight
      if (maxHeight !== undefined && 'maxHeight' in node) node.maxHeight = maxHeight
      return serializeNode(node)
    }

    case 'set-rotation': {
      const { id, angle } = args as { id: string; angle: number }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if ('rotation' in node) node.rotation = angle
      return serializeNode(node)
    }

    case 'set-stroke-align': {
      const { id, align } = args as { id: string; align: 'INSIDE' | 'OUTSIDE' | 'CENTER' }
      const node = (await figma.getNodeByIdAsync(id)) as GeometryMixin | null
      if (!node || !('strokeAlign' in node)) throw new Error('Node not found')
      node.strokeAlign = align
      return serializeNode(node as BaseNode)
    }

    // ==================== UPDATE STRUCTURE ====================
    case 'set-layout': {
      const {
        id,
        mode,
        wrap,
        clip,
        itemSpacing,
        primaryAxisAlignItems,
        counterAxisAlignItems,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        layoutSizingVertical,
        layoutSizingHorizontal
      } = args as {
        id: string
        mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
        wrap?: boolean
        clip?: boolean
        itemSpacing?: number
        primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'
        counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'
        paddingLeft?: number
        paddingRight?: number
        paddingTop?: number
        paddingBottom?: number
        layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL'
        layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL'
      }
      const node = (await figma.getNodeByIdAsync(id)) as FrameNode | null
      if (!node || !('layoutMode' in node)) throw new Error('Node not found')
      node.layoutMode = mode
      if (wrap !== undefined) node.layoutWrap = wrap ? 'WRAP' : 'NO_WRAP'
      if (clip !== undefined) node.clipsContent = clip
      if (itemSpacing !== undefined) node.itemSpacing = itemSpacing
      if (primaryAxisAlignItems) node.primaryAxisAlignItems = primaryAxisAlignItems
      if (counterAxisAlignItems) node.counterAxisAlignItems = counterAxisAlignItems
      if (paddingLeft !== undefined) node.paddingLeft = paddingLeft
      if (paddingRight !== undefined) node.paddingRight = paddingRight
      if (paddingTop !== undefined) node.paddingTop = paddingTop
      if (paddingBottom !== undefined) node.paddingBottom = paddingBottom
      if (layoutSizingVertical) node.layoutSizingVertical = layoutSizingVertical
      if (layoutSizingHorizontal) node.layoutSizingHorizontal = layoutSizingHorizontal
      return serializeNode(node)
    }

    case 'set-parent-id': {
      const { id, parentId } = args as { id: string; parentId: string }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      const parent = (await figma.getNodeByIdAsync(parentId)) as (FrameNode & ChildrenMixin) | null
      if (!node || !parent) throw new Error('Node or parent not found')
      parent.appendChild(node)
      return serializeNode(node)
    }

    case 'group-nodes': {
      const { ids, name } = args as { ids: string[]; name?: string }
      const nodes = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'parent' in n)
      if (validNodes.length === 0) throw new Error('No valid nodes found')
      const parent = validNodes[0].parent
      if (!parent || !('children' in parent)) throw new Error('Invalid parent')
      const group = figma.group(validNodes, parent)
      if (name) group.name = name
      return serializeNode(group)
    }

    case 'ungroup-node': {
      const { id } = args as { id: string }
      const node = (await figma.getNodeByIdAsync(id)) as GroupNode | null
      if (!node || node.type !== 'GROUP') throw new Error('Not a group node')
      const children = figma.ungroup(node)
      return children.map(serializeNode)
    }

    case 'flatten-nodes': {
      const { ids } = args as { ids: string[] }
      const nodes = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'parent' in n)
      if (validNodes.length === 0) throw new Error('No valid nodes found')
      const vector = figma.flatten(validNodes)
      return serializeNode(vector)
    }

    // ==================== BOOLEAN OPERATIONS ====================
    case 'boolean-operation': {
      const { ids, operation } = args as {
        ids: string[]
        operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE'
      }
      const nodes = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'parent' in n)
      if (validNodes.length < 2) throw new Error('Need at least 2 nodes')
      const parent = validNodes[0].parent
      if (!parent || !('children' in parent)) throw new Error('Invalid parent')
      let result: BooleanOperationNode
      switch (operation) {
        case 'UNION':
          result = figma.union(validNodes, parent)
          break
        case 'SUBTRACT':
          result = figma.subtract(validNodes, parent)
          break
        case 'INTERSECT':
          result = figma.intersect(validNodes, parent)
          break
        case 'EXCLUDE':
          result = figma.exclude(validNodes, parent)
          break
      }
      return serializeNode(result)
    }

    // ==================== INSTANCE/COMPONENT ====================
    case 'set-instance-properties': {
      const { instanceId, properties } = args as {
        instanceId: string
        properties: Record<string, unknown>
      }
      const instance = (await figma.getNodeByIdAsync(instanceId)) as InstanceNode | null
      if (!instance || instance.type !== 'INSTANCE') throw new Error('Instance not found')
      instance.setProperties(properties as { [key: string]: string | boolean })
      return serializeNode(instance)
    }

    case 'set-node-component-property-references': {
      const { id, componentPropertyReferences } = args as {
        id: string
        componentPropertyReferences: Record<string, string>
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node || !('componentPropertyReferences' in node)) throw new Error('Node not found')
      for (const [key, value] of Object.entries(componentPropertyReferences)) {
        node.componentPropertyReferences = { ...node.componentPropertyReferences, [key]: value }
      }
      return serializeNode(node)
    }

    case 'add-component-property': {
      const { componentId, name, type, defaultValue } = args as {
        componentId: string
        name: string
        type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT'
        defaultValue: string | boolean
      }
      const component = (await figma.getNodeByIdAsync(componentId)) as
        | ComponentNode
        | ComponentSetNode
        | null
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) {
        throw new Error('Component not found')
      }
      let parsedDefault: string | boolean = defaultValue
      if (type === 'BOOLEAN') parsedDefault = defaultValue === 'true' || defaultValue === true
      component.addComponentProperty(name, type, parsedDefault)
      return serializeNode(component)
    }

    case 'edit-component-property': {
      const { componentId, name, defaultValue, preferredValues } = args as {
        componentId: string
        name: string
        defaultValue: string | boolean
        preferredValues?: string[]
      }
      const component = (await figma.getNodeByIdAsync(componentId)) as
        | ComponentNode
        | ComponentSetNode
        | null
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) {
        throw new Error('Component not found')
      }
      const props = component.componentPropertyDefinitions
      const propKey = Object.keys(props).find((k) => k === name || k.startsWith(name + '#'))
      if (!propKey) throw new Error('Property not found')
      const propDef = props[propKey]
      let parsedDefault: string | boolean = defaultValue
      if (propDef.type === 'BOOLEAN')
        parsedDefault = defaultValue === 'true' || defaultValue === true
      component.editComponentProperty(propKey, {
        name,
        defaultValue: parsedDefault,
        preferredValues: preferredValues?.map((v) => ({ type: 'COMPONENT', key: v }))
      })
      return serializeNode(component)
    }

    case 'delete-component-property': {
      const { componentId, name } = args as { componentId: string; name: string }
      const component = (await figma.getNodeByIdAsync(componentId)) as
        | ComponentNode
        | ComponentSetNode
        | null
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) {
        throw new Error('Component not found')
      }
      const props = component.componentPropertyDefinitions
      const propKey = Object.keys(props).find((k) => k === name || k.startsWith(name + '#'))
      if (!propKey) throw new Error('Property not found')
      component.deleteComponentProperty(propKey)
      return serializeNode(component)
    }

    // ==================== VIEWPORT ====================
    case 'set-viewport': {
      const { x, y, zoom } = args as { x?: number; y?: number; zoom?: number }
      if (x !== undefined && y !== undefined) {
        figma.viewport.center = { x, y }
      }
      if (zoom !== undefined) {
        figma.viewport.zoom = zoom
      }
      return { center: figma.viewport.center, zoom: figma.viewport.zoom }
    }

    case 'zoom-to-fit': {
      const { ids } = args as { ids?: string[] }
      let nodes: SceneNode[]
      if (ids && ids.length > 0) {
        const fetched = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
        nodes = fetched.filter((n): n is SceneNode => n !== null && 'absoluteBoundingBox' in n)
      } else {
        nodes = figma.currentPage.selection as SceneNode[]
      }
      if (nodes.length > 0) {
        figma.viewport.scrollAndZoomIntoView(nodes)
      }
      return { center: figma.viewport.center, zoom: figma.viewport.zoom }
    }

    // ==================== EXPORT ====================
    case 'export-node': {
      const { id, format, scale } = args as {
        id: string
        format: 'PNG' | 'JPG' | 'SVG' | 'PDF'
        scale?: number
      }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      const bytes = await node.exportAsync({
        format: format,
        ...(format !== 'SVG' && format !== 'PDF' ? { scale: scale || 1 } : {})
      } as ExportSettings)
      return {
        data: figma.base64Encode(bytes),
        filename: `${node.name}.${format.toLowerCase()}`
      }
    }

    case 'export-node-svg': {
      const { id } = args as { id: string }
      const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      const bytes = await node.exportAsync({ format: 'SVG' })
      const decoder = new TextDecoder('utf-8')
      return { svg: decoder.decode(bytes) }
    }

    case 'batch-export-svg': {
      const { ids } = args as { ids: string[] }
      const decoder = new TextDecoder('utf-8')
      const results: Record<string, string> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null
            if (node) {
              const bytes = await node.exportAsync({ format: 'SVG' })
              results[id] = decoder.decode(bytes)
            }
          } catch {
            // Skip failed exports
          }
        })
      )
      return results
    }

    case 'screenshot': {
      const { scale } = args as { scale?: number }
      const bounds = figma.viewport.bounds
      const frame = figma.createFrame()
      frame.name = '__screenshot_temp__'
      frame.x = bounds.x
      frame.y = bounds.y
      frame.resize(bounds.width, bounds.height)
      frame.fills = []
      frame.clipsContent = true

      // Track clones that can't be parented to frame (sections, components)
      const orphanClones: SceneNode[] = []

      // Clone visible nodes that intersect viewport
      for (const node of figma.currentPage.children) {
        if (node.id === frame.id) continue
        if (!node.visible) continue
        if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
          const nb = node.absoluteBoundingBox
          if (
            nb.x + nb.width > bounds.x &&
            nb.x < bounds.x + bounds.width &&
            nb.y + nb.height > bounds.y &&
            nb.y < bounds.y + bounds.height
          ) {
            const clone = node.clone()
            clone.x = node.x - bounds.x
            clone.y = node.y - bounds.y
            frame.appendChild(clone)
            // Sections can't be parented to frames - they stay on page
            if (clone.parent === figma.currentPage) {
              orphanClones.push(clone)
            }
          }
        }
      }

      const bytes = await frame.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: scale || 1 }
      })

      // Clean up orphan clones first, then frame
      for (const clone of orphanClones) {
        clone.remove()
      }
      frame.remove()

      return { data: figma.base64Encode(bytes) }
    }

    case 'export-selection': {
      const { format, scale, padding } = args as {
        format?: 'PNG' | 'JPG' | 'SVG' | 'PDF'
        scale?: number
        padding?: number
      }
      const selection = figma.currentPage.selection
      if (selection.length === 0) throw new Error('No selection')

      // If single node, export directly
      if (selection.length === 1 && !padding) {
        const bytes = await selection[0].exportAsync({
          format: format || 'PNG',
          ...(format !== 'SVG' && format !== 'PDF' ? { scale: scale || 2 } : {})
        } as ExportSettings)
        return { data: figma.base64Encode(bytes) }
      }

      // Multiple nodes or padding: create temp frame
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const node of selection) {
        if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
          const b = node.absoluteBoundingBox
          minX = Math.min(minX, b.x)
          minY = Math.min(minY, b.y)
          maxX = Math.max(maxX, b.x + b.width)
          maxY = Math.max(maxY, b.y + b.height)
        }
      }

      const pad = padding || 0
      const frame = figma.createFrame()
      frame.name = '__export_temp__'
      frame.x = minX - pad
      frame.y = minY - pad
      frame.resize(maxX - minX + pad * 2, maxY - minY + pad * 2)
      frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
      frame.clipsContent = true

      for (const node of selection) {
        const clone = node.clone()
        clone.x = node.x - frame.x
        clone.y = node.y - frame.y
        frame.appendChild(clone)
      }

      const bytes = await frame.exportAsync({
        format: format || 'PNG',
        ...(format !== 'SVG' && format !== 'PDF' ? { scale: scale || 2 } : {})
      } as ExportSettings)
      frame.remove()
      return { data: figma.base64Encode(bytes) }
    }

    // ==================== DELETE ====================
    case 'delete-node': {
      const { ids, id } = args as { ids?: string[]; id?: string }
      const nodeIds = ids ?? (id ? [id] : [])
      if (nodeIds.length === 0) throw new Error('No node IDs provided')

      let deleted = 0
      for (const nodeId of nodeIds) {
        const node = await figma.getNodeByIdAsync(nodeId)
        if (node && 'remove' in node) {
          node.remove()
          deleted++
        }
      }
      return { deleted }
    }

    // ==================== BOUNDS ====================
    case 'node-bounds': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || !('x' in node)) throw new Error('Node not found')
      const sn = node as SceneNode
      return {
        x: Math.round(sn.x * 100) / 100,
        y: Math.round(sn.y * 100) / 100,
        width: Math.round(sn.width * 100) / 100,
        height: Math.round(sn.height * 100) / 100,
        centerX: Math.round((sn.x + sn.width / 2) * 100) / 100,
        centerY: Math.round((sn.y + sn.height / 2) * 100) / 100,
        right: Math.round((sn.x + sn.width) * 100) / 100,
        bottom: Math.round((sn.y + sn.height) * 100) / 100
      }
    }

    // ==================== PATH ====================
    case 'path-get': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'VECTOR') throw new Error('Vector node not found')
      return { paths: node.vectorPaths }
    }

    case 'path-set': {
      const {
        id,
        path,
        windingRule = 'NONZERO'
      } = args as { id: string; path: string; windingRule?: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'VECTOR') throw new Error('Vector node not found')
      node.vectorPaths = [{ windingRule: windingRule as WindingRule, data: path }]
      return { updated: true }
    }

    case 'path-move': {
      const { id, dx = 0, dy = 0 } = args as { id: string; dx?: number; dy?: number }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'VECTOR') throw new Error('Vector node not found')

      const newPaths = node.vectorPaths.map((p) => ({
        windingRule: p.windingRule,
        data: svgPathToString(svgpath(p.data).translate(dx, dy).round(2))
      }))
      node.vectorPaths = newPaths
      return { updated: true, paths: newPaths }
    }

    case 'path-scale': {
      const { id, factor } = args as { id: string; factor: number }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'VECTOR') throw new Error('Vector node not found')

      const newPaths = node.vectorPaths.map((p) => ({
        windingRule: p.windingRule,
        data: svgPathToString(svgpath(p.data).scale(factor).round(2))
      }))
      node.vectorPaths = newPaths
      return { updated: true, paths: newPaths }
    }

    case 'path-flip': {
      const { id, axis } = args as { id: string; axis: 'x' | 'y' }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'VECTOR') throw new Error('Vector node not found')

      // Flip using scale with negative value
      const newPaths = node.vectorPaths.map((p) => ({
        windingRule: p.windingRule,
        data:
          axis === 'x'
            ? svgPathToString(svgpath(p.data).scale(-1, 1).round(2))
            : svgPathToString(svgpath(p.data).scale(1, -1).round(2))
      }))
      node.vectorPaths = newPaths
      return { updated: true, paths: newPaths }
    }

    // ==================== QUERY ====================
    case 'query': {
      const { selector, rootId, select, limit } = args as {
        selector: string
        rootId?: string
        select?: string[]
        limit?: number
      }
      const root = rootId ? await figma.getNodeByIdAsync(rootId) : figma.currentPage
      if (!root) return { error: 'Root node not found' }

      const nodes = queryNodes(selector, root, { limit: limit ?? 1000 })
      const fields = select || ['id', 'name', 'type', 'x', 'y', 'width', 'height']

      return nodes.map((node) => {
        const result: Record<string, unknown> = {}
        for (const field of fields) {
          if (field in node) {
            const value = (node as unknown as Record<string, unknown>)[field]
            // Round geometry values for cleaner output
            if (
              (field === 'x' || field === 'y' || field === 'width' || field === 'height') &&
              typeof value === 'number'
            ) {
              result[field] = Math.round(value)
            } else {
              result[field] = value
            }
          }
        }
        return result
      })
    }

    // ==================== WIDGET JSX ====================
    case 'create-from-jsx': {
      const { tree, x, y, parentId } = args as {
        tree: unknown
        x?: number
        y?: number
        parentId?: string
      }

      const { AutoLayout, Rectangle, Ellipse, Text, Line, SVG, Image } = figma.widget
      const h = figma.widget.h
      type WidgetComponent = Parameters<typeof h>[0]

      const TYPE_MAP: Record<string, WidgetComponent> = {
        frame: AutoLayout,
        view: AutoLayout,
        rectangle: Rectangle,
        rect: Rectangle,
        ellipse: Ellipse,
        text: Text,
        line: Line,
        svg: SVG,
        image: Image
      } as Record<string, WidgetComponent>

      // Shorthand expansions (Tailwind-like)
      const SHORTHANDS: Record<string, string> = {
        w: 'width',
        h: 'height',
        bg: 'fill',
        rounded: 'cornerRadius',
        roundedTL: '__roundedTL',
        roundedTR: '__roundedTR',
        roundedBL: '__roundedBL',
        roundedBR: '__roundedBR',
        cornerSmoothing: '__cornerSmoothing',
        p: 'padding',
        px: '__px',
        py: '__py',
        pt: '__pt',
        pr: '__pr',
        pb: '__pb',
        pl: '__pl',
        size: 'fontSize',
        font: 'fontFamily',
        weight: 'fontWeight',
        flex: 'direction',
        gap: 'spacing',
        wrap: '__wrap',
        rowGap: '__rowGap',
        minW: '__minW',
        maxW: '__maxW',
        minH: '__minH',
        maxH: '__maxH',
        position: '__position',
        grow: '__grow',
        stretch: '__stretch',
        strokeAlign: '__strokeAlign',
        strokeTop: '__strokeTop',
        strokeBottom: '__strokeBottom',
        strokeLeft: '__strokeLeft',
        strokeRight: '__strokeRight',
        rotate: '__rotate',
        overflow: '__overflow',
        shadow: '__shadow',
        blur: '__blur',
        blendMode: '__blendMode'
      }

      const DIRECTION_MAP: Record<string, string> = {
        row: 'horizontal',
        column: 'vertical',
        col: 'vertical'
      }

      const ALIGN_MAP: Record<string, string> = {
        start: 'start',
        end: 'end',
        center: 'center',
        between: 'space-between'
      }

      // Nodes that need wrap applied after creation
      const wrapNodes: Array<{ path: number[]; rowGap?: number }> = []
      // Nodes that need post-processing for properties not supported by Widget API
      const postProcessNodes: Array<{
        path: number[]
        roundedTL?: number
        roundedTR?: number
        roundedBL?: number
        roundedBR?: number
        cornerSmoothing?: number
        minW?: number
        maxW?: number
        minH?: number
        maxH?: number
        position?: string
        grow?: number
        stretch?: boolean
        strokeAlign?: string
        strokeTop?: number
        strokeBottom?: number
        strokeLeft?: number
        strokeRight?: number
        rotate?: number
        overflow?: string
        shadow?: string
        blur?: number
        blendMode?: string
      }> = []

      function processProps(
        props: Record<string, unknown>,
        isText: boolean
      ): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        // Expand shorthands
        for (const [key, value] of Object.entries(props)) {
          const mapped = SHORTHANDS[key] || key
          result[mapped] = value
        }

        // Direction
        if (result.direction) {
          result.direction = DIRECTION_MAP[result.direction as string] || result.direction
        }

        // Alignment shorthands
        if (result.justify) {
          result.horizontalAlignItems = ALIGN_MAP[result.justify as string] || result.justify
          delete result.justify
        }
        if (result.items) {
          result.verticalAlignItems = ALIGN_MAP[result.items as string] || result.items
          delete result.items
        }

        // Padding expansion
        const p = result.padding as number | undefined
        const px = result.__px as number | undefined
        const py = result.__py as number | undefined
        const pt = result.__pt as number | undefined
        const pr = result.__pr as number | undefined
        const pb = result.__pb as number | undefined
        const pl = result.__pl as number | undefined

        delete result.__px
        delete result.__py
        delete result.__pt
        delete result.__pr
        delete result.__pb
        delete result.__pl

        if (
          px !== undefined ||
          py !== undefined ||
          pt !== undefined ||
          pr !== undefined ||
          pb !== undefined ||
          pl !== undefined
        ) {
          result.padding = {
            top: pt ?? py ?? p ?? 0,
            right: pr ?? px ?? p ?? 0,
            bottom: pb ?? py ?? p ?? 0,
            left: pl ?? px ?? p ?? 0
          }
        }

        // Fill for text = color prop
        if (isText && result.color && !result.fill) {
          result.fill = result.color
          delete result.color
        }

        // Width 'fill' → 'fill-parent'
        if (result.width === 'fill') result.width = 'fill-parent'
        if (result.height === 'fill') result.height = 'fill-parent'

        return result
      }

      // Nodes that need SVG import after tree creation
      const svgNodes: Array<{ path: number[]; svgString: string }> = []
      // Nodes that need instance creation after tree creation
      const instanceNodes: Array<{ path: number[]; componentId: string; name?: string }> = []

      function buildTree(node: unknown, path: number[] = []): unknown {
        if (typeof node === 'string' || typeof node === 'number') return node
        if (!node || typeof node !== 'object') return null

        const { type, props, children } = node as {
          type: string
          props: Record<string, unknown>
          children: unknown[]
        }

        // Handle inline <svg> - mark for post-processing with createNodeFromSvg
        if (type === 'svg' && props.__svgString) {
          svgNodes.push({ path: [...path], svgString: props.__svgString as string })
          // Create placeholder frame
          return h(AutoLayout, { width: props.width || 24, height: props.height || 24 })
        }

        // Handle <instance> - mark for post-processing with createInstance
        if (type === 'instance') {
          const componentId = props.component as string
          if (!componentId) throw new Error('<Instance> requires component prop')
          instanceNodes.push({
            path: [...path],
            componentId,
            name: props.name as string | undefined
          })
          // Create placeholder frame
          return h(AutoLayout, { width: props.width || 100, height: props.height || 100 })
        }

        const Component = TYPE_MAP[type]
        if (!Component) throw new Error(`Unknown element: <${type}>`)

        const isText = type === 'text'
        const processed = processProps(props || {}, isText)

        // Track wrap nodes
        if (processed.__wrap) {
          wrapNodes.push({ path: [...path], rowGap: processed.__rowGap as number | undefined })
          delete processed.__wrap
          delete processed.__rowGap
        }

        // Collect props that need post-processing (not supported by Widget API)
        const postProps: Record<string, unknown> = {}
        const postKeys = [
          '__roundedTL',
          '__roundedTR',
          '__roundedBL',
          '__roundedBR',
          '__cornerSmoothing',
          '__minW',
          '__maxW',
          '__minH',
          '__maxH',
          '__position',
          '__grow',
          '__stretch',
          '__strokeAlign',
          '__strokeTop',
          '__strokeBottom',
          '__strokeLeft',
          '__strokeRight',
          '__rotate',
          '__overflow',
          '__shadow',
          '__blur',
          '__blendMode'
        ]
        for (const key of postKeys) {
          if (processed[key] !== undefined) {
            const cleanKey = key.slice(2) // remove '__' prefix
            postProps[cleanKey] = processed[key]
            delete processed[key]
          }
        }
        if (Object.keys(postProps).length > 0) {
          postProcessNodes.push({ path: [...path], ...postProps } as (typeof postProcessNodes)[0])
        }

        const builtChildren = (children || [])
          .map((c, i) => buildTree(c, [...path, i]))
          .filter(Boolean)

        return builtChildren.length === 0
          ? h(Component, processed)
          : h(Component, processed, ...builtChildren)
      }

      const widgetTree = buildTree(tree)
      const node = await figma.createNodeFromJSXAsync(
        widgetTree as Parameters<typeof figma.createNodeFromJSXAsync>[0]
      )

      // Apply position
      if (x !== undefined) node.x = x
      if (y !== undefined) node.y = y

      // Apply wrap (Widget API doesn't support it directly)
      for (const { path, rowGap } of wrapNodes) {
        let target: SceneNode = node
        for (const index of path) {
          if ('children' in target) target = (target as FrameNode).children[index]
        }
        if (target && 'layoutWrap' in target) {
          const frame = target as FrameNode
          frame.layoutWrap = 'WRAP'
          frame.primaryAxisSizingMode = 'FIXED'
          frame.counterAxisSizingMode = 'AUTO'
          if (rowGap !== undefined) frame.counterAxisSpacing = rowGap
        }
      }

      // Apply post-process properties not supported by Widget API
      for (const pp of postProcessNodes) {
        let target: SceneNode = node
        for (const index of pp.path) {
          if ('children' in target) target = (target as FrameNode).children[index]
        }
        if (!target) continue

        // Individual corner radii
        if ('topLeftRadius' in target) {
          const frame = target as FrameNode
          if (pp.roundedTL !== undefined) frame.topLeftRadius = pp.roundedTL
          if (pp.roundedTR !== undefined) frame.topRightRadius = pp.roundedTR
          if (pp.roundedBL !== undefined) frame.bottomLeftRadius = pp.roundedBL
          if (pp.roundedBR !== undefined) frame.bottomRightRadius = pp.roundedBR
        }
        // Corner smoothing (squircle)
        if ('cornerSmoothing' in target && pp.cornerSmoothing !== undefined) {
          ;(target as FrameNode).cornerSmoothing = pp.cornerSmoothing
        }
        // Min/max constraints
        if ('minWidth' in target) {
          const frame = target as FrameNode
          if (pp.minW !== undefined) frame.minWidth = pp.minW
          if (pp.maxW !== undefined) frame.maxWidth = pp.maxW
          if (pp.minH !== undefined) frame.minHeight = pp.minH
          if (pp.maxH !== undefined) frame.maxHeight = pp.maxH
        }
        // Absolute positioning
        if ('layoutPositioning' in target && pp.position === 'absolute') {
          ;(target as FrameNode).layoutPositioning = 'ABSOLUTE'
        }
        // Flex grow
        if ('layoutGrow' in target && pp.grow !== undefined) {
          ;(target as FrameNode).layoutGrow = pp.grow
        }
        // Stretch
        if ('layoutAlign' in target && pp.stretch) {
          ;(target as FrameNode).layoutAlign = 'STRETCH'
        }
        // Stroke align
        if ('strokeAlign' in target && pp.strokeAlign) {
          ;(target as FrameNode).strokeAlign = pp.strokeAlign.toUpperCase() as
            | 'INSIDE'
            | 'OUTSIDE'
            | 'CENTER'
        }
        // Individual stroke weights
        if ('strokeTopWeight' in target) {
          const frame = target as FrameNode
          if (pp.strokeTop !== undefined) frame.strokeTopWeight = pp.strokeTop
          if (pp.strokeBottom !== undefined) frame.strokeBottomWeight = pp.strokeBottom
          if (pp.strokeLeft !== undefined) frame.strokeLeftWeight = pp.strokeLeft
          if (pp.strokeRight !== undefined) frame.strokeRightWeight = pp.strokeRight
        }
        // Rotation
        if ('rotation' in target && pp.rotate !== undefined) {
          target.rotation = pp.rotate
        }
        // Clips content (overflow)
        if ('clipsContent' in target && pp.overflow === 'hidden') {
          ;(target as FrameNode).clipsContent = true
        }
        // Blend mode
        if ('blendMode' in target && pp.blendMode) {
          const mode = pp.blendMode.toUpperCase().replace(/-/g, '_')
          ;(target as BlendMixin).blendMode = mode as BlendMode
        }
        // Effects (shadow, blur)
        if ('effects' in target) {
          const effects: Effect[] = []
          if (pp.shadow) {
            const parts = pp.shadow.match(
              /(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s+(-?\d+(?:\.\d+)?px)\s*(-?\d+(?:\.\d+)?px)?\s*(.+)?/
            )
            if (parts) {
              const x = parseFloat(parts[1])
              const y = parseFloat(parts[2])
              const blur = parseFloat(parts[3])
              const spread = parts[4] ? parseFloat(parts[4]) : 0
              const colorStr = parts[5]?.trim() || 'rgba(0,0,0,0.25)'
              // Parse color
              let r = 0,
                g = 0,
                b = 0,
                a = 0.25
              const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
              if (rgbaMatch) {
                r = parseInt(rgbaMatch[1]) / 255
                g = parseInt(rgbaMatch[2]) / 255
                b = parseInt(rgbaMatch[3]) / 255
                a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
              }
              effects.push({
                type: 'DROP_SHADOW',
                visible: true,
                blendMode: 'NORMAL',
                radius: blur,
                spread,
                offset: { x, y },
                color: { r, g, b, a }
              })
            }
          }
          if (pp.blur !== undefined) {
            effects.push({
              type: 'LAYER_BLUR',
              visible: true,
              radius: pp.blur
            })
          }
          if (effects.length > 0) {
            ;(target as FrameNode).effects = effects
          }
        }
      }

      // Replace SVG placeholders with actual SVG nodes
      for (const { path, svgString } of svgNodes) {
        let target: SceneNode = node
        let parent: FrameNode | null = null
        let childIndex = 0
        for (let i = 0; i < path.length; i++) {
          if ('children' in target) {
            parent = target as FrameNode
            childIndex = path[i]
            target = parent.children[childIndex]
          }
        }
        if (parent && target) {
          const svgNode = figma.createNodeFromSvg(svgString)
          svgNode.x = target.x
          svgNode.y = target.y
          parent.insertChild(childIndex, svgNode)
          target.remove()
        }
      }

      // Replace instance placeholders with actual component instances
      for (const { path, componentId, name } of instanceNodes) {
        let target: SceneNode = node
        let parent: FrameNode | null = null
        let childIndex = 0
        for (let i = 0; i < path.length; i++) {
          if ('children' in target) {
            parent = target as FrameNode
            childIndex = path[i]
            target = parent.children[childIndex]
          }
        }
        const component = (await figma.getNodeByIdAsync(componentId)) as ComponentNode | null
        if (!component || component.type !== 'COMPONENT') {
          throw new Error(`Component not found: ${componentId}`)
        }
        const instance = component.createInstance()
        if (name) instance.name = name
        if (parent) {
          instance.x = target.x
          instance.y = target.y
          parent.insertChild(childIndex, instance)
          target.remove()
        } else {
          // Root instance
          instance.x = node.x
          instance.y = node.y
          figma.currentPage.appendChild(instance)
          node.remove()
          // Update node reference for parent attachment
          ;(node as unknown as { id: string }).id = instance.id
        }
      }

      // Attach to parent
      if (parentId) {
        const parent = await figma.getNodeByIdAsync(parentId)
        if (parent && 'appendChild' in parent) (parent as FrameNode).appendChild(node)
      } else {
        figma.currentPage.appendChild(node)
      }

      figma.viewport.scrollAndZoomIntoView([node])
      return { id: node.id, name: node.name }
    }

    // ==================== EVAL ====================
    case 'eval': {
      const { code } = args as { code: string }
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      // Wrap code to support top-level await
      const wrappedCode = code.trim().startsWith('return')
        ? code
        : `return (async () => { ${code} })()`
      const fn = new AsyncFunction('figma', wrappedCode)
      return await fn(figma)
    }

    // ==================== LAYOUT ====================
    case 'trigger-layout': {
      // Fix TEXT nodes and trigger auto-layout recalculation
      // Multiplayer protocol doesn't auto-size text or trigger layout engine
      interface PendingInstance {
        componentSetName: string
        variantName: string
        parentGUID: { sessionID: number; localID: number }
        position: string
        x: number
        y: number
      }
      interface PendingGridLayout {
        nodeGUID: { sessionID: number; localID: number }
        gridTemplateColumns?: string
        gridTemplateRows?: string
      }
      const { nodeId, pendingComponentSetInstances, pendingGridLayouts } = args as {
        nodeId: string
        pendingComponentSetInstances?: PendingInstance[]
        pendingGridLayouts?: PendingGridLayout[]
      }
      // Multiplayer nodes may not be immediately visible
      const root = await retry(() => figma.getNodeByIdAsync(nodeId), 10, 100, 'linear')
      if (!root) return null

      // Create ComponentSet instances via Plugin API (multiplayer can't link them correctly)
      if (pendingComponentSetInstances && pendingComponentSetInstances.length > 0) {
        for (const pending of pendingComponentSetInstances) {
          // Find the ComponentSet by name
          const findComponentSet = (node: SceneNode): ComponentSetNode | null => {
            if (node.type === 'COMPONENT_SET' && node.name === pending.componentSetName) {
              return node
            }
            if ('children' in node) {
              for (const child of node.children) {
                const found = findComponentSet(child)
                if (found) return found
              }
            }
            return null
          }

          const componentSet = findComponentSet(root as SceneNode)
          if (!componentSet) continue

          // Find the variant component by name
          const variantComp = componentSet.children.find(
            (c) => c.type === 'COMPONENT' && c.name === pending.variantName
          ) as ComponentNode | undefined
          if (!variantComp) continue

          // Create instance
          const instance = variantComp.createInstance()
          instance.x = pending.x
          instance.y = pending.y

          // Find parent node
          const parentId = `${pending.parentGUID.sessionID}:${pending.parentGUID.localID}`
          const parent = await figma.getNodeByIdAsync(parentId)
          if (parent && 'appendChild' in parent) {
            ;(parent as FrameNode).appendChild(instance)
          }
        }
      }

      // Apply pending Grid layouts
      if (pendingGridLayouts && pendingGridLayouts.length > 0) {
        for (const grid of pendingGridLayouts) {
          const nodeId = `${grid.nodeGUID.sessionID}:${grid.nodeGUID.localID}`
          const node = await figma.getNodeByIdAsync(nodeId)
          if (!node || node.type !== 'FRAME') continue

          const frame = node as FrameNode
          if (frame.layoutMode !== 'GRID') {
            frame.layoutMode = 'GRID'
          }

          // Parse grid template syntax: "100px 1fr auto" → [{type, value}, ...]
          const parseGridTemplate = (
            template: string
          ): Array<{ type: 'FIXED' | 'FLEX' | 'HUG'; value: number }> => {
            return template
              .split(/\s+/)
              .filter(Boolean)
              .map((part) => {
                if (part.endsWith('px')) {
                  return { type: 'FIXED' as const, value: parseFloat(part) }
                } else if (part.endsWith('fr')) {
                  return { type: 'FLEX' as const, value: parseFloat(part) || 1 }
                } else if (part === 'auto' || part === 'hug') {
                  return { type: 'HUG' as const, value: 1 }
                } else {
                  return { type: 'FIXED' as const, value: parseFloat(part) || 100 }
                }
              })
          }

          // Parse templates first to get counts
          const colSizes = grid.gridTemplateColumns
            ? parseGridTemplate(grid.gridTemplateColumns)
            : null
          const rowSizes = grid.gridTemplateRows ? parseGridTemplate(grid.gridTemplateRows) : null

          // Set counts first (Figma requires this before setting sizes)
          if (colSizes && colSizes.length > 0) {
            frame.gridColumnCount = colSizes.length
          }
          if (rowSizes && rowSizes.length > 0) {
            frame.gridRowCount = rowSizes.length
          }

          // Now set sizes
          if (colSizes && colSizes.length > 0) {
            frame.gridColumnSizes = colSizes
          }
          if (rowSizes && rowSizes.length > 0) {
            frame.gridRowSizes = rowSizes
          }
        }
      }

      // First pass: fix children (bottom-up for correct sizing)
      const fixRecursive = async (node: SceneNode) => {
        // Process children first (bottom-up)
        if ('children' in node) {
          for (const child of node.children) {
            await fixRecursive(child)
          }
        }

        // Fix TEXT nodes: reload characters to trigger auto-resize
        if (node.type === 'TEXT' && node.textAutoResize !== 'NONE') {
          try {
            await figma.loadFontAsync(node.fontName as FontName)
            const chars = node.characters
            node.characters = ''
            node.characters = chars
          } catch {
            // Font not available, skip
          }
        }

        // Fix auto-layout frames
        if ('layoutMode' in node && node.layoutMode !== 'NONE') {
          const frame = node as FrameNode
          const needsPrimaryRecalc = frame.primaryAxisSizingMode === 'AUTO'
          const needsCounterRecalc = frame.counterAxisSizingMode === 'AUTO'
          if (needsPrimaryRecalc || needsCounterRecalc) {
            // Re-apply AUTO sizing to trigger recalculation
            // Temporarily set to FIXED, then back to AUTO forces Figma to recalc
            if (needsPrimaryRecalc) {
              frame.primaryAxisSizingMode = 'FIXED'
              frame.primaryAxisSizingMode = 'AUTO'
            }
            if (needsCounterRecalc) {
              frame.counterAxisSizingMode = 'FIXED'
              frame.counterAxisSizingMode = 'AUTO'
            }
          }
        }
      }

      await fixRecursive(root as SceneNode)
      return { triggered: true }
    }

    // ==================== VARIABLES ====================
    case 'get-variables': {
      const { type, simple } = args as { type?: string; simple?: boolean }
      const variables = await figma.variables.getLocalVariablesAsync(
        type as VariableResolvedDataType | undefined
      )
      // Simple mode returns only id and name (for variable registry)
      if (simple) {
        return variables.map((v) => ({ id: v.id, name: v.name }))
      }
      return variables.map((v) => serializeVariable(v))
    }

    case 'find-variables': {
      const { query, type, limit = 20 } = args as { query: string; type?: string; limit?: number }
      const variables = await figma.variables.getLocalVariablesAsync(
        type as VariableResolvedDataType | undefined
      )
      const lowerQuery = query.toLowerCase()
      const matches = variables
        .filter((v) => v.name.toLowerCase().includes(lowerQuery))
        .slice(0, limit)
      return matches.map((v) => serializeVariable(v))
    }

    case 'get-variable': {
      const { id } = args as { id: string }
      const variable = await figma.variables.getVariableByIdAsync(id)
      if (!variable) throw new Error('Variable not found')
      return serializeVariable(variable)
    }

    case 'create-variable': {
      const { name, collectionId, type, value } = args as {
        name: string
        collectionId: string
        type: string
        value?: string
      }
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId)
      if (!collection) throw new Error('Collection not found')
      const variable = figma.variables.createVariable(
        name,
        collection,
        type as VariableResolvedDataType
      )
      if (value !== undefined && collection.modes.length > 0) {
        const modeId = collection.modes[0].modeId
        variable.setValueForMode(modeId, parseVariableValue(value, type))
      }
      return serializeVariable(variable)
    }

    case 'set-variable-value': {
      const { id, modeId, value } = args as { id: string; modeId: string; value: string }
      const variable = await figma.variables.getVariableByIdAsync(id)
      if (!variable) throw new Error('Variable not found')
      variable.setValueForMode(modeId, parseVariableValue(value, variable.resolvedType))
      return serializeVariable(variable)
    }

    case 'delete-variable': {
      const { id } = args as { id: string }
      const variable = await figma.variables.getVariableByIdAsync(id)
      if (!variable) throw new Error('Variable not found')
      variable.remove()
      return { deleted: true }
    }

    case 'bind-variable': {
      const { nodeId, field, variableId } = args as {
        nodeId: string
        field: string
        variableId: string
      }
      const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      if ('setBoundVariable' in node) {
        ;(node as any).setBoundVariable(field, variable)
      } else {
        throw new Error('Node does not support variable binding')
      }
      return serializeNode(node)
    }

    case 'bind-fill-variable': {
      const {
        nodeId,
        variableId,
        paintIndex = 0
      } = args as { nodeId: string; variableId: string; paintIndex?: number }
      const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('fills' in node)) throw new Error('Node does not have fills')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      const fills = (node as GeometryMixin).fills as Paint[]
      if (!fills[paintIndex]) throw new Error('Paint not found at index ' + paintIndex)
      const newFill = figma.variables.setBoundVariableForPaint(fills[paintIndex], 'color', variable)
      ;(node as GeometryMixin).fills = [
        ...fills.slice(0, paintIndex),
        newFill,
        ...fills.slice(paintIndex + 1)
      ]
      return serializeNode(node)
    }

    case 'bind-stroke-variable': {
      const {
        nodeId,
        variableId,
        paintIndex = 0
      } = args as { nodeId: string; variableId: string; paintIndex?: number }
      const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('strokes' in node)) throw new Error('Node does not have strokes')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      const strokes = (node as GeometryMixin).strokes as Paint[]
      if (!strokes[paintIndex]) throw new Error('Paint not found at index ' + paintIndex)
      const newStroke = figma.variables.setBoundVariableForPaint(
        strokes[paintIndex],
        'color',
        variable
      )
      ;(node as GeometryMixin).strokes = [
        ...strokes.slice(0, paintIndex),
        newStroke,
        ...strokes.slice(paintIndex + 1)
      ]
      return serializeNode(node)
    }

    // ==================== VARIABLE COLLECTIONS ====================
    case 'get-variable-collections': {
      const collections = await figma.variables.getLocalVariableCollectionsAsync()
      return collections.map((c) => serializeCollection(c))
    }

    case 'get-variable-collection': {
      const { id } = args as { id: string }
      const collection = await figma.variables.getVariableCollectionByIdAsync(id)
      if (!collection) throw new Error('Collection not found')
      return serializeCollection(collection)
    }

    case 'create-variable-collection': {
      const { name } = args as { name: string }
      const collection = figma.variables.createVariableCollection(name)
      return serializeCollection(collection)
    }

    case 'delete-variable-collection': {
      const { id } = args as { id: string }
      const collection = await figma.variables.getVariableCollectionByIdAsync(id)
      if (!collection) throw new Error('Collection not found')
      collection.remove()
      return { deleted: true }
    }

    // ==================== CONNECTORS ====================
    case 'create-connector': {
      if (figma.editorType !== 'figjam') {
        throw new Error(
          'Connectors can only be created in FigJam files. Open a FigJam file and try again.'
        )
      }

      const {
        fromId,
        toId,
        fromMagnet,
        toMagnet,
        lineType,
        startCap,
        endCap,
        stroke,
        strokeWeight,
        cornerRadius
      } = args as {
        fromId: string
        toId: string
        fromMagnet?: string
        toMagnet?: string
        lineType?: 'STRAIGHT' | 'ELBOWED' | 'CURVED'
        startCap?: string
        endCap?: string
        stroke?: string
        strokeWeight?: number
        cornerRadius?: number
      }

      const fromNode = await figma.getNodeByIdAsync(fromId)
      const toNode = await figma.getNodeByIdAsync(toId)
      if (!fromNode || !('absoluteBoundingBox' in fromNode))
        throw new Error('From node not found or invalid')
      if (!toNode || !('absoluteBoundingBox' in toNode))
        throw new Error('To node not found or invalid')

      // Map friendly cap names to FigJam enum values
      const mapCapCreate = (cap: string): ConnectorStrokeCap => {
        const mapping: Record<string, ConnectorStrokeCap> = {
          NONE: 'NONE',
          ARROW: 'ARROW_EQUILATERAL',
          ARROW_EQUILATERAL: 'ARROW_EQUILATERAL',
          ARROW_LINES: 'ARROW_LINES',
          TRIANGLE: 'TRIANGLE_FILLED',
          TRIANGLE_FILLED: 'TRIANGLE_FILLED',
          DIAMOND: 'DIAMOND_FILLED',
          DIAMOND_FILLED: 'DIAMOND_FILLED',
          CIRCLE: 'CIRCLE_FILLED',
          CIRCLE_FILLED: 'CIRCLE_FILLED'
        }
        return mapping[cap] || 'NONE'
      }

      const connector = figma.createConnector()
      connector.connectorStart = {
        endpointNodeId: fromId,
        magnet: (fromMagnet as ConnectorMagnet) || 'AUTO'
      }
      connector.connectorEnd = {
        endpointNodeId: toId,
        magnet: (toMagnet as ConnectorMagnet) || 'AUTO'
      }

      if (lineType) connector.connectorLineType = lineType
      if (startCap) connector.connectorStartStrokeCap = mapCapCreate(startCap)
      if (endCap) connector.connectorEndStrokeCap = mapCapCreate(endCap)
      if (cornerRadius !== undefined) connector.cornerRadius = cornerRadius
      if (strokeWeight !== undefined) connector.strokeWeight = strokeWeight
      if (stroke) {
        const hex = stroke.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        connector.strokes = [{ type: 'SOLID', color: { r, g, b } }]
      }

      return serializeNode(connector)
    }

    case 'get-connector': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'CONNECTOR') throw new Error('Connector not found')

      const connector = node as ConnectorNode
      const fromNode = await figma.getNodeByIdAsync(connector.connectorStart.endpointNodeId)
      const toNode = await figma.getNodeByIdAsync(connector.connectorEnd.endpointNodeId)

      const stroke = connector.strokes[0]
      const strokeHex =
        stroke && stroke.type === 'SOLID'
          ? '#' +
            [stroke.color.r, stroke.color.g, stroke.color.b]
              .map((c) =>
                Math.round(c * 255)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('')
              .toUpperCase()
          : undefined

      return {
        id: connector.id,
        name: connector.name,
        fromNode: {
          id: connector.connectorStart.endpointNodeId,
          name: fromNode?.name || 'Unknown',
          magnet: connector.connectorStart.magnet
        },
        toNode: {
          id: connector.connectorEnd.endpointNodeId,
          name: toNode?.name || 'Unknown',
          magnet: connector.connectorEnd.magnet
        },
        lineType: connector.connectorLineType,
        startCap: connector.connectorStartStrokeCap,
        endCap: connector.connectorEndStrokeCap,
        stroke: strokeHex,
        strokeWeight: connector.strokeWeight,
        cornerRadius: connector.cornerRadius
      }
    }

    case 'set-connector': {
      const {
        id,
        fromId,
        toId,
        fromMagnet,
        toMagnet,
        lineType,
        startCap,
        endCap,
        stroke,
        strokeWeight,
        cornerRadius
      } = args as {
        id: string
        fromId?: string
        toId?: string
        fromMagnet?: string
        toMagnet?: string
        lineType?: 'STRAIGHT' | 'ELBOWED' | 'CURVED'
        startCap?: string
        endCap?: string
        stroke?: string
        strokeWeight?: number
        cornerRadius?: number
      }

      const node = await figma.getNodeByIdAsync(id)
      if (!node || node.type !== 'CONNECTOR') throw new Error('Connector not found')

      const connector = node as ConnectorNode

      if (fromId) {
        connector.connectorStart = {
          endpointNodeId: fromId,
          magnet: (fromMagnet as ConnectorMagnet) || connector.connectorStart.magnet
        }
      } else if (fromMagnet) {
        connector.connectorStart = {
          ...connector.connectorStart,
          magnet: fromMagnet as ConnectorMagnet
        }
      }

      if (toId) {
        connector.connectorEnd = {
          endpointNodeId: toId,
          magnet: (toMagnet as ConnectorMagnet) || connector.connectorEnd.magnet
        }
      } else if (toMagnet) {
        connector.connectorEnd = {
          ...connector.connectorEnd,
          magnet: toMagnet as ConnectorMagnet
        }
      }

      // Map friendly cap names to FigJam enum values
      const mapCapSet = (cap: string): ConnectorStrokeCap => {
        const mapping: Record<string, ConnectorStrokeCap> = {
          NONE: 'NONE',
          ARROW: 'ARROW_EQUILATERAL',
          ARROW_EQUILATERAL: 'ARROW_EQUILATERAL',
          ARROW_LINES: 'ARROW_LINES',
          TRIANGLE: 'TRIANGLE_FILLED',
          TRIANGLE_FILLED: 'TRIANGLE_FILLED',
          DIAMOND: 'DIAMOND_FILLED',
          DIAMOND_FILLED: 'DIAMOND_FILLED',
          CIRCLE: 'CIRCLE_FILLED',
          CIRCLE_FILLED: 'CIRCLE_FILLED'
        }
        return mapping[cap] || 'NONE'
      }

      if (lineType) connector.connectorLineType = lineType
      if (startCap) connector.connectorStartStrokeCap = mapCapSet(startCap)
      if (endCap) connector.connectorEndStrokeCap = mapCapSet(endCap)
      if (cornerRadius !== undefined) connector.cornerRadius = cornerRadius
      if (strokeWeight !== undefined) connector.strokeWeight = strokeWeight
      if (stroke) {
        const hex = stroke.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        connector.strokes = [{ type: 'SOLID', color: { r, g, b } }]
      }

      return serializeNode(connector)
    }

    case 'list-connectors': {
      const { fromId, toId } = args as { fromId?: string; toId?: string }
      const page = figma.currentPage
      const connectors: ConnectorNode[] = []

      function findConnectors(node: BaseNode) {
        if (node.type === 'CONNECTOR') {
          const c = node as ConnectorNode
          if (fromId && c.connectorStart.endpointNodeId !== fromId) return
          if (toId && c.connectorEnd.endpointNodeId !== toId) return
          connectors.push(c)
        }
        if ('children' in node) {
          for (const child of (node as ChildrenMixin).children) {
            findConnectors(child)
          }
        }
      }

      findConnectors(page)

      const results = await Promise.all(
        connectors.map(async (c) => {
          const fromNode = await figma.getNodeByIdAsync(c.connectorStart.endpointNodeId)
          const toNode = await figma.getNodeByIdAsync(c.connectorEnd.endpointNodeId)
          const stroke = c.strokes[0]
          const strokeHex =
            stroke && stroke.type === 'SOLID'
              ? '#' +
                [stroke.color.r, stroke.color.g, stroke.color.b]
                  .map((v) =>
                    Math.round(v * 255)
                      .toString(16)
                      .padStart(2, '0')
                  )
                  .join('')
                  .toUpperCase()
              : undefined

          return {
            id: c.id,
            name: c.name,
            fromNode: {
              id: c.connectorStart.endpointNodeId,
              name: fromNode?.name || 'Unknown',
              magnet: c.connectorStart.magnet
            },
            toNode: {
              id: c.connectorEnd.endpointNodeId,
              name: toNode?.name || 'Unknown',
              magnet: c.connectorEnd.magnet
            },
            lineType: c.connectorLineType,
            stroke: strokeHex
          }
        })
      )

      return results
    }

    case 'find-page': {
      const { name } = args as { name: string }
      const pages = figma.root.children
      const lowerName = name.toLowerCase()

      // Exact match first
      let page = pages.find((p) => p.name === name)
      // Then partial match
      if (!page) {
        page = pages.find((p) => p.name.toLowerCase().includes(lowerName))
      }

      return page?.id ?? null
    }

    case 'lint-tree': {
      const { rootId } = args as { rootId?: string }
      let root: BaseNode

      if (rootId) {
        const node = await figma.getNodeByIdAsync(rootId)
        if (!node) throw new Error(`Node ${rootId} not found`)
        root = node
      } else {
        root = figma.currentPage
      }

      function serializeForLint(node: BaseNode): object {
        const result: Record<string, unknown> = {
          id: node.id,
          name: node.name,
          type: node.type
        }

        // Geometry
        if ('x' in node) result.x = node.x
        if ('y' in node) result.y = node.y
        if ('width' in node) result.width = node.width
        if ('height' in node) result.height = node.height
        if ('rotation' in node) result.rotation = node.rotation

        // Visibility
        if ('visible' in node) result.visible = node.visible
        if ('locked' in node) result.locked = node.locked

        // Fills & Strokes with variable bindings
        if ('fills' in node && Array.isArray(node.fills)) {
          result.fills = node.fills.map((paint: Paint) => {
            const p: Record<string, unknown> = {
              type: paint.type,
              visible: paint.visible !== false
            }
            if (paint.type === 'SOLID') {
              p.color = {
                r: paint.color.r,
                g: paint.color.g,
                b: paint.color.b
              }
              p.opacity = paint.opacity
              // Check for variable binding
              if ('boundVariables' in paint && paint.boundVariables?.color) {
                p.boundVariables = { color: { id: paint.boundVariables.color.id } }
              }
            }
            return p
          })
        }

        if ('strokes' in node && Array.isArray(node.strokes)) {
          result.strokes = node.strokes.map((paint: Paint) => {
            const p: Record<string, unknown> = {
              type: paint.type,
              visible: paint.visible !== false
            }
            if (paint.type === 'SOLID') {
              p.color = {
                r: paint.color.r,
                g: paint.color.g,
                b: paint.color.b
              }
              p.opacity = paint.opacity
              if ('boundVariables' in paint && paint.boundVariables?.color) {
                p.boundVariables = { color: { id: paint.boundVariables.color.id } }
              }
            }
            return p
          })
        }

        if ('strokeWeight' in node) result.strokeWeight = node.strokeWeight
        if ('cornerRadius' in node) result.cornerRadius = node.cornerRadius

        // Layout
        if ('layoutMode' in node) {
          result.layoutMode = node.layoutMode
          if ('itemSpacing' in node) result.itemSpacing = node.itemSpacing
          if ('paddingTop' in node) {
            result.paddingTop = node.paddingTop
            result.paddingRight = node.paddingRight
            result.paddingBottom = node.paddingBottom
            result.paddingLeft = node.paddingLeft
          }
        }

        // Text
        if (node.type === 'TEXT') {
          const textNode = node as TextNode
          result.characters = textNode.characters
          result.fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : undefined
          result.fontName = typeof textNode.fontName === 'object' ? textNode.fontName : undefined
          result.lineHeight =
            typeof textNode.lineHeight === 'object' ? textNode.lineHeight : undefined
          result.textStyleId = textNode.textStyleId || undefined
        }

        // Components
        if (node.type === 'INSTANCE') {
          const instance = node as InstanceNode
          result.componentId = instance.componentId
          if (instance.mainComponent) {
            result.mainComponent = {
              id: instance.mainComponent.id,
              name: instance.mainComponent.name
            }
          }
        }

        // Effects
        if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
          result.effects = node.effects.map((e) => ({
            type: e.type,
            visible: e.visible,
            radius: 'radius' in e ? e.radius : undefined,
            color: 'color' in e ? e.color : undefined,
            offset: 'offset' in e ? e.offset : undefined
          }))
        }

        // Children (recursive)
        if ('children' in node && (node as ChildrenMixin).children.length > 0) {
          result.children = (node as ChildrenMixin).children.map(serializeForLint)
        }

        return result
      }

      return JSON.stringify(serializeForLint(root))
    }

    case 'variable-list': {
      const variables = await figma.variables.getLocalVariablesAsync()
      return JSON.stringify(
        variables.map((v) => ({
          id: v.id,
          name: v.name,
          resolvedType: v.resolvedType,
          valuesByMode: v.valuesByMode
        }))
      )
    }

    case 'analyze-clusters': {
      const {
        minSize = 30,
        minCount = 2,
        limit = 20
      } = args as {
        minSize?: number
        minCount?: number
        limit?: number
      }

      const SIZE_BUCKETS = [
        16, 24, 32, 40, 48, 64, 80, 100, 120, 150, 200, 250, 300, 400, 500, 800, 1000, 1280, 1920
      ]

      function toBucket(val: number): number {
        return SIZE_BUCKETS.reduce((prev, curr) =>
          Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
        )
      }

      function getSignature(node: SceneNode): string {
        const wBucket = toBucket(node.width)
        const hBucket = toBucket(node.height)

        const childTypes = new Map<string, number>()
        if ('children' in node) {
          for (const child of node.children) {
            const t = child.type === 'INSTANCE' ? 'COMPONENT' : child.type
            childTypes.set(t, (childTypes.get(t) || 0) + 1)
          }
        }

        const childSig = [...childTypes.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([t, n]) => `${t}:${n}`)
          .join(',')

        return childSig
          ? `${node.type}:${wBucket}x${hBucket}|${childSig}`
          : `${node.type}:${wBucket}x${hBucket}`
      }

      const nodes = figma.currentPage.findAll()
      const clusters = new Map<
        string,
        Array<{
          id: string
          name: string
          width: number
          height: number
          childCount: number
          type: string
        }>
      >()

      for (const node of nodes) {
        // Skip instances, vectors, text, lines
        if (node.type === 'INSTANCE') continue
        if (node.type === 'VECTOR') continue
        if (node.type === 'LINE') continue
        if (node.type === 'BOOLEAN_OPERATION') continue
        if (node.type === 'TEXT') continue
        if (node.type === 'ELLIPSE') continue
        if (node.type === 'RECTANGLE') continue
        if (node.type === 'POLYGON') continue
        if (node.type === 'STAR') continue

        // Skip small elements
        if (node.width < minSize || node.height < minSize) continue

        const sig = getSignature(node)
        if (!clusters.has(sig)) clusters.set(sig, [])
        clusters.get(sig)!.push({
          id: node.id,
          name: node.name,
          width: Math.round(node.width),
          height: Math.round(node.height),
          childCount: 'children' in node ? node.children.length : 0,
          type: node.type
        })
      }

      // Filter and sort
      const result = [...clusters.entries()]
        .filter(([_, nodes]) => nodes.length >= minCount)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, limit)
        .map(([signature, nodes]) => {
          const widths = nodes.map((n) => n.width)
          const heights = nodes.map((n) => n.height)
          return {
            signature,
            nodes,
            avgWidth: widths.reduce((a, b) => a + b, 0) / widths.length,
            avgHeight: heights.reduce((a, b) => a + b, 0) / heights.length,
            widthRange: Math.max(...widths) - Math.min(...widths),
            heightRange: Math.max(...heights) - Math.min(...heights)
          }
        })

      return { clusters: result, totalNodes: nodes.length }
    }

    case 'analyze-colors': {
      // Key: "hex|variableName" or "hex|" for hardcoded
      const colors = new Map<
        string,
        {
          hex: string
          count: number
          nodes: string[]
          variableName: string | null
          isVariable: boolean
          isStyle: boolean
        }
      >()
      const variableCache = new Map<string, string>()

      async function getVariableName(varId: string): Promise<string | null> {
        if (variableCache.has(varId)) return variableCache.get(varId)!
        try {
          const variable = await figma.variables.getVariableByIdAsync(varId)
          const name = variable?.name || null
          if (name) variableCache.set(varId, name)
          return name
        } catch {
          return null
        }
      }

      async function addColor(
        hex: string,
        varName: string | null,
        nodeId: string,
        isStyle: boolean
      ) {
        const key = `${hex}|${varName || ''}`
        const entry = colors.get(key) || {
          hex,
          count: 0,
          nodes: [],
          variableName: varName,
          isVariable: !!varName,
          isStyle: false
        }
        entry.count++
        if (entry.nodes.length < 5) entry.nodes.push(nodeId)
        if (isStyle) entry.isStyle = true
        colors.set(key, entry)
      }

      async function extractColors(node: SceneNode) {
        const hasStyle =
          'fillStyleId' in node && node.fillStyleId && typeof node.fillStyleId === 'string'

        if ('fills' in node && Array.isArray(node.fills)) {
          for (const fill of node.fills) {
            if (fill.type === 'SOLID' && fill.visible !== false) {
              const hex = rgbToHex(fill.color).toUpperCase()
              const varBinding = fill.boundVariables?.color
              const varName = varBinding ? await getVariableName(varBinding.id) : null
              await addColor(hex, varName, node.id, !!hasStyle)
            }
          }
        }
        if ('strokes' in node && Array.isArray(node.strokes)) {
          for (const stroke of node.strokes) {
            if (stroke.type === 'SOLID' && stroke.visible !== false) {
              const hex = rgbToHex(stroke.color).toUpperCase()
              const varBinding = stroke.boundVariables?.color
              const varName = varBinding ? await getVariableName(varBinding.id) : null
              await addColor(hex, varName, node.id, false)
            }
          }
        }
      }

      const nodes = figma.currentPage.findAll()
      for (const node of nodes) {
        await extractColors(node)
      }

      const result = [...colors.values()]

      return { colors: result, totalNodes: nodes.length }
    }

    case 'analyze-typography': {
      // Key includes styleName to separate same font with/without style
      const styles = new Map<
        string,
        {
          family: string
          size: number
          weight: string
          lineHeight: string
          count: number
          nodes: string[]
          styleName: string | null
        }
      >()

      const styleCache = new Map<string, string>()

      async function getStyleName(styleId: string): Promise<string | null> {
        if (styleCache.has(styleId)) return styleCache.get(styleId)!
        try {
          const style = await figma.getStyleByIdAsync(styleId)
          const name = style?.name || null
          if (name) styleCache.set(styleId, name)
          return name
        } catch {
          return null
        }
      }

      const nodes = figma.currentPage.findAll((n) => n.type === 'TEXT') as TextNode[]

      for (const node of nodes) {
        const font = node.fontName
        if (font === figma.mixed) continue

        const family = font.family
        const weight = font.style
        const size = typeof node.fontSize === 'number' ? node.fontSize : 0
        const lh = node.lineHeight
        const lineHeight =
          lh === figma.mixed
            ? 'mixed'
            : lh.unit === 'AUTO'
              ? 'auto'
              : lh.unit === 'PERCENT'
                ? `${lh.value}%`
                : `${lh.value}px`

        const styleId =
          node.textStyleId && typeof node.textStyleId === 'string' ? node.textStyleId : null
        const styleName = styleId ? await getStyleName(styleId) : null

        const key = `${family}|${size}|${weight}|${lineHeight}|${styleName || ''}`

        const entry = styles.get(key) || {
          family,
          size,
          weight,
          lineHeight,
          count: 0,
          nodes: [],
          styleName
        }
        entry.count++
        if (entry.nodes.length < 5) entry.nodes.push(node.id)
        styles.set(key, entry)
      }

      return {
        styles: [...styles.values()],
        totalTextNodes: nodes.length
      }
    }

    case 'analyze-spacing': {
      const gaps = new Map<number, { count: number; nodes: string[] }>()
      const paddings = new Map<number, { count: number; nodes: string[] }>()

      const nodes = figma.currentPage.findAll()

      for (const node of nodes) {
        if (!('layoutMode' in node) || node.layoutMode === 'NONE') continue

        // Gap (itemSpacing)
        if ('itemSpacing' in node && typeof node.itemSpacing === 'number') {
          const val = Math.round(node.itemSpacing)
          const entry = gaps.get(val) || { count: 0, nodes: [] }
          entry.count++
          if (entry.nodes.length < 5) entry.nodes.push(node.id)
          gaps.set(val, entry)
        }

        // Padding
        if ('paddingTop' in node) {
          const values = [
            Math.round(node.paddingTop || 0),
            Math.round(node.paddingRight || 0),
            Math.round(node.paddingBottom || 0),
            Math.round(node.paddingLeft || 0)
          ]
          for (const val of values) {
            if (val === 0) continue
            const entry = paddings.get(val) || { count: 0, nodes: [] }
            entry.count++
            if (entry.nodes.length < 5) entry.nodes.push(node.id)
            paddings.set(val, entry)
          }
        }
      }

      return {
        gaps: [...gaps.entries()].map(([value, data]) => ({
          value,
          type: 'gap' as const,
          count: data.count,
          nodes: data.nodes
        })),
        paddings: [...paddings.entries()].map(([value, data]) => ({
          value,
          type: 'padding' as const,
          count: data.count,
          nodes: data.nodes
        })),
        totalNodes: nodes.length
      }
    }

    case 'snapshot': {
      const {
        id,
        interactive,
        maxDepth = -1,
        compact = true
      } = args as {
        id?: string
        interactive?: boolean
        maxDepth?: number
        compact?: boolean
      }

      // === ARIA Role Detection ===
      // Priority: explicit component name > structural heuristics > generic

      const INTERACTIVE_ROLES = new Set([
        'button',
        'link',
        'textbox',
        'searchbox',
        'checkbox',
        'radio',
        'switch',
        'combobox',
        'listbox',
        'slider',
        'spinbutton',
        'tab',
        'menuitem',
        'option',
        'treeitem'
      ])

      // Pattern-based role detection from component/frame names
      const NAME_PATTERNS: Array<{
        pattern: RegExp
        role: string
        props?: Record<string, unknown>
      }> = [
        // Interactive - buttons
        { pattern: /^button$/i, role: 'button' },
        { pattern: /^btn[-_\s]/i, role: 'button' },
        { pattern: /[-_\s]btn$/i, role: 'button' },
        { pattern: /^cta$/i, role: 'button' },
        { pattern: /^icon[-_]?button$/i, role: 'button' },
        // Interactive - links
        { pattern: /^link$/i, role: 'link' },
        { pattern: /^anchor$/i, role: 'link' },
        { pattern: /^text[-_]?link$/i, role: 'link' },
        // Interactive - inputs
        { pattern: /^input$/i, role: 'textbox' },
        { pattern: /^text[-_]?field$/i, role: 'textbox' },
        { pattern: /^text[-_]?input$/i, role: 'textbox' },
        { pattern: /^text[-_]?area$/i, role: 'textbox', props: { multiline: true } },
        { pattern: /^search$/i, role: 'searchbox' },
        { pattern: /^search[-_]?input$/i, role: 'searchbox' },
        { pattern: /^password$/i, role: 'textbox' },
        // Interactive - checkboxes, radios, switches
        { pattern: /^checkbox$/i, role: 'checkbox' },
        { pattern: /^check[-_]?box$/i, role: 'checkbox' },
        { pattern: /^radio$/i, role: 'radio' },
        { pattern: /^radio[-_]?button$/i, role: 'radio' },
        { pattern: /^switch$/i, role: 'switch' },
        { pattern: /^toggle$/i, role: 'switch' },
        // Interactive - selects
        { pattern: /^select$/i, role: 'combobox' },
        { pattern: /^dropdown$/i, role: 'combobox' },
        { pattern: /^combo[-_]?box$/i, role: 'combobox' },
        { pattern: /^autocomplete$/i, role: 'combobox' },
        // Interactive - other
        { pattern: /^slider$/i, role: 'slider' },
        { pattern: /^range$/i, role: 'slider' },
        { pattern: /^tab$/i, role: 'tab' },
        { pattern: /^menu[-_]?item$/i, role: 'menuitem' },
        { pattern: /^option$/i, role: 'option' },
        // Content - headings
        { pattern: /^heading$/i, role: 'heading' },
        { pattern: /^title$/i, role: 'heading' },
        { pattern: /^h1$/i, role: 'heading', props: { level: 1 } },
        { pattern: /^h2$/i, role: 'heading', props: { level: 2 } },
        { pattern: /^h3$/i, role: 'heading', props: { level: 3 } },
        { pattern: /^h4$/i, role: 'heading', props: { level: 4 } },
        { pattern: /^h5$/i, role: 'heading', props: { level: 5 } },
        { pattern: /^h6$/i, role: 'heading', props: { level: 6 } },
        // Content - landmarks
        { pattern: /^header$/i, role: 'banner' },
        { pattern: /^nav$/i, role: 'navigation' },
        { pattern: /^navbar$/i, role: 'navigation' },
        { pattern: /^navigation$/i, role: 'navigation' },
        { pattern: /^sidebar$/i, role: 'complementary' },
        { pattern: /^footer$/i, role: 'contentinfo' },
        { pattern: /^main$/i, role: 'main' },
        { pattern: /^section$/i, role: 'region' },
        { pattern: /^article$/i, role: 'article' },
        // Content - structure
        { pattern: /^form$/i, role: 'form' },
        { pattern: /^table$/i, role: 'table' },
        { pattern: /^row$/i, role: 'row' },
        { pattern: /^cell$/i, role: 'cell' },
        { pattern: /^list$/i, role: 'list' },
        { pattern: /^list[-_]?item$/i, role: 'listitem' },
        { pattern: /^menu$/i, role: 'menu' },
        { pattern: /^toolbar$/i, role: 'toolbar' },
        { pattern: /^tabs$/i, role: 'tablist' },
        { pattern: /^tab[-_]?panel$/i, role: 'tabpanel' },
        { pattern: /^breadcrumb$/i, role: 'navigation' },
        // Content - UI elements
        { pattern: /^card$/i, role: 'article' },
        { pattern: /^modal$/i, role: 'dialog' },
        { pattern: /^dialog$/i, role: 'dialog' },
        { pattern: /^popup$/i, role: 'dialog' },
        { pattern: /^tooltip$/i, role: 'tooltip' },
        { pattern: /^alert$/i, role: 'alert' },
        { pattern: /^toast$/i, role: 'alert' },
        { pattern: /^notification$/i, role: 'alert' },
        { pattern: /^badge$/i, role: 'status' },
        { pattern: /^tag$/i, role: 'status' },
        { pattern: /^chip$/i, role: 'status' },
        { pattern: /^progress$/i, role: 'progressbar' },
        { pattern: /^spinner$/i, role: 'progressbar' },
        { pattern: /^loader$/i, role: 'progressbar' },
        // Images
        { pattern: /^avatar$/i, role: 'img' },
        { pattern: /^icon$/i, role: 'img' },
        { pattern: /^image$/i, role: 'img' },
        { pattern: /^img$/i, role: 'img' },
        { pattern: /^logo$/i, role: 'img' },
        { pattern: /^thumbnail$/i, role: 'img' },
        // Labels
        { pattern: /^label$/i, role: 'label' },
        { pattern: /^caption$/i, role: 'caption' },
        { pattern: /^placeholder$/i, role: 'presentation' }
      ]

      // Text patterns that suggest a link
      const LINK_TEXT_PATTERNS = [
        /^https?:\/\//i, // URLs
        /^www\./i,
        /\.(com|ru|org|net|io|dev)$/i,
        /^@\w+/, // mentions
        /^#\w+/ // hashtags
      ]

      // Extract base name from component path like "UI/Buttons/Primary, State=Default"
      function getBaseName(name: string): string {
        return name.split('/').pop()?.split(',')[0]?.trim() || name
      }

      // Detect role from node name patterns
      function detectRoleFromName(
        name: string
      ): { role: string; props?: Record<string, unknown> } | null {
        const baseName = getBaseName(name)
        for (const { pattern, role, props } of NAME_PATTERNS) {
          if (pattern.test(baseName)) {
            return { role, props }
          }
        }
        return null
      }

      // Extract component variant properties (e.g., "State=Checked" -> { checked: true })
      function extractVariantProps(node: SceneNode): Record<string, unknown> {
        const props: Record<string, unknown> = {}

        if (node.type === 'INSTANCE') {
          const instance = node as InstanceNode
          // Check component properties
          for (const [key, value] of Object.entries(instance.componentProperties || {})) {
            const propName = key.toLowerCase()
            const propValue = typeof value === 'object' && 'value' in value ? value.value : value

            if (
              propName.includes('state') ||
              propName.includes('checked') ||
              propName.includes('selected')
            ) {
              if (
                propValue === 'Checked' ||
                propValue === 'Selected' ||
                propValue === 'On' ||
                propValue === true
              ) {
                props.checked = true
              }
            }
            if (propName.includes('disabled') || propName.includes('state')) {
              if (propValue === 'Disabled' || propValue === false) {
                props.disabled = true
              }
            }
            if (propName.includes('expanded') || propName.includes('open')) {
              if (propValue === 'Expanded' || propValue === 'Open' || propValue === true) {
                props.expanded = true
              }
            }
          }
        }

        // Also check name for variant info like "Switch, State=On"
        const nameParts = node.name.split(',')
        for (const part of nameParts) {
          const [key, val] = part.split('=').map((s) => s.trim().toLowerCase())
          if (key === 'state' || key === 'checked' || key === 'selected') {
            if (val === 'checked' || val === 'selected' || val === 'on' || val === 'active') {
              props.checked = true
            }
            if (val === 'disabled') {
              props.disabled = true
            }
          }
          if (key === 'expanded' || key === 'open') {
            if (val === 'true' || val === 'expanded' || val === 'open') {
              props.expanded = true
            }
          }
        }

        // Check opacity for disabled state
        if ('opacity' in node && (node as SceneNode & { opacity: number }).opacity < 0.5) {
          props.disabled = true
        }

        return props
      }

      // Collect all text from children (for computing accessible name)
      function collectText(node: SceneNode, maxLength = 100): string {
        if (node.type === 'TEXT') {
          return (node as TextNode).characters.trim()
        }
        if (!('children' in node)) return ''

        const texts: string[] = []
        for (const child of (node as ChildrenMixin).children) {
          if ('visible' in child && !child.visible) continue
          const text = collectText(child as SceneNode, maxLength - texts.join(' ').length)
          if (text) texts.push(text)
          if (texts.join(' ').length >= maxLength) break
        }
        return texts.join(' ').slice(0, maxLength)
      }

      // Check if node looks like a button (structural heuristics)
      // Chrome relies on <button>, role="button", cursor:pointer — we use visual patterns
      function looksLikeButton(node: SceneNode): boolean {
        if (!('children' in node)) return false
        if (node.type !== 'FRAME' && node.type !== 'INSTANCE' && node.type !== 'COMPONENT')
          return false

        const frame = node as FrameNode

        // Must have bounded size (not a container)
        if (frame.width > 200) return false
        if (frame.height > 50) return false
        if (frame.height < 28) return false // Typical button min height

        // Check for text content
        const text = collectText(node, 50).trim()
        if (!text) return false

        // Skip if text is just a number, date-like, initials, or very long
        if (/^\d+$/.test(text)) return false
        if (/^\d{2}[\.\-\/]\d{2}/.test(text)) return false // date patterns
        if (text.length < 4 || text.length > 25) return false // buttons typically 4-25 chars (skip initials like "АД")

        // Must look styled like a button: fill + rounded corners + auto-layout with padding
        const hasFill =
          Array.isArray(frame.fills) && frame.fills.some((f: Paint) => f.visible !== false)
        if (!hasFill) return false

        const hasRadius = 'cornerRadius' in frame && (frame.cornerRadius as number) >= 4
        if (!hasRadius) return false // buttons almost always have rounded corners

        const hasAutoLayout = frame.layoutMode !== 'NONE'
        if (!hasAutoLayout) return false

        // Must have meaningful horizontal padding (button-like)
        const hPadding = (frame.paddingLeft || 0) + (frame.paddingRight || 0)
        if (hPadding < 16) return false

        return true
      }

      // Check if node looks like an input field
      function looksLikeInput(node: SceneNode): boolean {
        if (!('children' in node)) return false
        if (!('layoutMode' in node)) return false

        const frame = node as FrameNode
        // Typical input: horizontal layout, has stroke or specific background
        if (frame.layoutMode !== 'HORIZONTAL') return false
        if (frame.strokes?.length === 0 && !frame.fills?.length) return false

        // Should have placeholder-like text or be relatively empty
        const text = collectText(node, 50)
        const placeholderWords = [
          'введите',
          'enter',
          'search',
          'поиск',
          'email',
          'пароль',
          'password',
          'name',
          'имя'
        ]
        if (placeholderWords.some((w) => text.toLowerCase().includes(w))) return true

        return false
      }

      // Infer heading level from font size
      function inferHeadingLevel(node: SceneNode): number | undefined {
        if (node.type !== 'TEXT') return undefined
        const textNode = node as TextNode
        const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 16
        if (fontSize >= 32) return 1
        if (fontSize >= 24) return 2
        if (fontSize >= 20) return 3
        if (fontSize >= 18) return 4
        if (fontSize >= 16) return 5
        return 6
      }

      // Check if text node looks like a link (underlined, blue, or URL-like text)
      function looksLikeLink(node: SceneNode): boolean {
        if (node.type !== 'TEXT') return false
        const textNode = node as TextNode
        const text = textNode.characters.trim()
        if (!text) return false

        // Check for URL patterns
        if (LINK_TEXT_PATTERNS.some((p) => p.test(text))) return true

        // Check for underline decoration
        if (textNode.textDecoration === 'UNDERLINE') return true

        // Check for blue-ish color (common link color)
        if (Array.isArray(textNode.fills)) {
          for (const fill of textNode.fills) {
            if (fill.type === 'SOLID' && fill.visible !== false) {
              const { r, g, b } = fill.color
              // Blue-ish: more blue than red and green
              if (b > 0.5 && b > r && b > g) return true
            }
          }
        }

        return false
      }

      // Check if node is a separator/divider (thin horizontal or vertical line)
      function looksLikeSeparator(node: SceneNode): boolean {
        if (!('width' in node) || !('height' in node)) return false
        const w = (node as SceneNode & { width: number }).width
        const h = (node as SceneNode & { height: number }).height

        // Horizontal separator: very thin height, wider than tall
        if (h <= 2 && w > h * 10 && w >= 20) return true
        // Vertical separator: very thin width, taller than wide
        if (w <= 2 && h > w * 10 && h >= 20) return true

        return false
      }

      // Check if node looks like a list (vertical stack of similar items)
      function looksLikeList(node: SceneNode): { isList: boolean; itemCount: number } | null {
        if (!('children' in node)) return null
        if (!('layoutMode' in node)) return null

        const frame = node as FrameNode
        if (frame.layoutMode !== 'VERTICAL') return null

        const children = frame.children.filter((c) => 'visible' in c && c.visible)
        if (children.length < 3) return null // Need at least 3 items for a list

        // Check if children have similar structure (same type, similar size)
        const types = children.map((c) => c.type)
        const allSameType = types.every((t) => t === types[0])
        if (!allSameType) return null

        // Check similar heights (within 20% tolerance)
        const heights = children.map((c) =>
          'height' in c ? (c as SceneNode & { height: number }).height : 0
        )
        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length
        if (avgHeight === 0) return null
        const similarHeights = heights.every((h) => Math.abs(h - avgHeight) / avgHeight < 0.2)
        if (!similarHeights) return null

        return { isList: true, itemCount: children.length }
      }

      // Check if node is purely decorative (should be ignored)
      function isDecorative(node: SceneNode): boolean {
        // Very small elements are likely decorative
        if ('width' in node && 'height' in node) {
          const w = (node as SceneNode & { width: number }).width
          const h = (node as SceneNode & { height: number }).height
          if (w < 4 && h < 4) return true
        }

        // Elements named with decorative patterns
        const decorativePatterns = [
          /^divider$/i,
          /^spacer$/i,
          /^line$/i,
          /^decoration$/i,
          /^bg$/i,
          /^background$/i
        ]
        if (decorativePatterns.some((p) => p.test(node.name))) return true

        return false
      }

      // Check if node looks like a table/grid structure
      interface TableInfo {
        isTable: boolean
        rowCount: number
        colCount: number
        hasHeader: boolean
      }

      function detectTableStructure(node: SceneNode): TableInfo | null {
        if (!('children' in node)) return null
        if (!('layoutMode' in node)) return null

        const frame = node as FrameNode
        // Table container should be vertical auto-layout
        if (frame.layoutMode !== 'VERTICAL') return null

        const children = frame.children.filter((c) => 'children' in c) as FrameNode[]
        if (children.length < 2) return null // Need at least header + 1 row

        // Check if all rows have similar structure (same number of cells)
        const cellCounts = children.map((row) => {
          if (!('children' in row)) return 0
          return (row as FrameNode).children.length
        })

        // All rows should have same number of cells (or close)
        const firstRowCells = cellCounts[0]
        if (firstRowCells < 2) return null // Need at least 2 columns
        const allSimilar = cellCounts.every((c) => Math.abs(c - firstRowCells) <= 1)
        if (!allSimilar) return null

        // Check if first row looks like a header (different style or contains header-like text)
        const firstRow = children[0]
        let hasHeader = false
        if ('children' in firstRow) {
          const firstRowChildren = (firstRow as FrameNode).children
          // Check if first row has bold text or different background
          hasHeader = firstRowChildren.some((cell) => {
            if (cell.type === 'TEXT') {
              const textNode = cell as TextNode
              // Check for bold font weight
              if (typeof textNode.fontWeight === 'number' && textNode.fontWeight >= 600) return true
              if (
                typeof textNode.fontName === 'object' &&
                textNode.fontName.style?.toLowerCase().includes('bold')
              )
                return true
            }
            return false
          })
        }

        return {
          isTable: true,
          rowCount: children.length,
          colCount: firstRowCells,
          hasHeader
        }
      }

      let refCounter = 0
      const refs: Record<string, { id: string; role: string; name?: string }> = {}

      interface AXNode {
        role: string
        name?: string
        id?: string
        ref?: string
        props?: Record<string, unknown>
        children?: AXNode[]
      }

      function buildAXTree(node: SceneNode, depth: number): AXNode | null {
        try {
          if (maxDepth !== -1 && depth > maxDepth) return null
          if ('visible' in node && !node.visible) return null
          // Safety: skip nodes without valid string ID
          if (!node.id || typeof node.id !== 'string') return null

          // Text nodes -> StaticText
          if (node.type === 'TEXT') {
            const textNode = node as TextNode
            const chars = textNode.characters.trim()
            if (!chars) return null
            return {
              role: 'StaticText',
              name: chars.length > 100 ? chars.slice(0, 100) + '…' : chars,
              id: node.id
            }
          }

          // Determine role
          let role = 'generic'
          let props: Record<string, unknown> = {}
          let accessibleName: string | undefined

          // 1. Check explicit role from component/frame name
          const nameDetected = detectRoleFromName(node.name)
          if (nameDetected) {
            role = nameDetected.role
            if (nameDetected.props) props = { ...props, ...nameDetected.props }
          }

          // 2. For instances, also check main component name
          if (node.type === 'INSTANCE') {
            const mainComp = (node as InstanceNode).mainComponent
            if (mainComp) {
              const compDetected = detectRoleFromName(mainComp.name)
              if (compDetected) {
                role = compDetected.role
                if (compDetected.props) props = { ...props, ...compDetected.props }
              }
              accessibleName = getBaseName(mainComp.name)
            }
          }

          // 3. Structural heuristics if still generic
          if (role === 'generic') {
            // Check for decorative elements first - skip them
            if (isDecorative(node)) {
              return null
            }

            // Check for separator
            if (looksLikeSeparator(node)) {
              role = 'separator'
            }
            // Check for table structure
            else {
              const tableInfo = detectTableStructure(node)
              if (tableInfo?.isTable) {
                role = 'table'
                props.rowCount = tableInfo.rowCount
                props.colCount = tableInfo.colCount
              }
              // Check for list structure
              else {
                const listInfo = looksLikeList(node)
                if (listInfo?.isList) {
                  role = 'list'
                  props.itemCount = listInfo.itemCount
                }
                // Check for button
                else if (looksLikeButton(node)) {
                  role = 'button'
                  accessibleName = collectText(node, 50)
                }
                // Check for input
                else if (looksLikeInput(node)) {
                  role = 'textbox'
                  accessibleName = collectText(node, 50) || undefined
                }
              }
            }
          }

          // 3a. Special case: text nodes that look like links
          if (node.type === 'TEXT' && looksLikeLink(node)) {
            const textNode = node as TextNode
            return {
              role: 'link',
              name: textNode.characters.trim().slice(0, 100),
              id: node.id
            }
          }

          // 4. Extract variant properties (checked, disabled, expanded)
          const variantProps = extractVariantProps(node)
          props = { ...props, ...variantProps }

          // 5. Compute accessible name if not set
          if (!accessibleName && INTERACTIVE_ROLES.has(role)) {
            accessibleName = collectText(node, 50) || getBaseName(node.name)
          }

          // 5a. For controls with generic name, try to find label from sibling
          const controlRoles = new Set([
            'switch',
            'checkbox',
            'radio',
            'slider',
            'textbox',
            'combobox'
          ])
          if (
            controlRoles.has(role) &&
            accessibleName &&
            /^(switch|checkbox|radio|input|toggle)$/i.test(accessibleName)
          ) {
            // Look at siblings for label text
            const parent = node.parent
            if (parent && 'children' in parent) {
              const siblings = (parent as ChildrenMixin).children
              const nodeIndex = siblings.indexOf(node as SceneNode)
              // Check previous sibling for label
              if (nodeIndex > 0) {
                const prevSibling = siblings[nodeIndex - 1]
                if (prevSibling.type === 'TEXT') {
                  accessibleName = (prevSibling as TextNode).characters.trim()
                } else if ('children' in prevSibling) {
                  const siblingText = collectText(prevSibling as SceneNode, 80)
                  if (siblingText && siblingText.length > 1) {
                    accessibleName = siblingText
                  }
                }
              }
            }
          }

          // 6. Add heading level
          if (role === 'heading' && !props.level) {
            // Try to infer from first text child
            if ('children' in node) {
              const textChild = (node as ChildrenMixin).children.find((c) => c.type === 'TEXT')
              if (textChild) {
                props.level = inferHeadingLevel(textChild as SceneNode)
              }
            }
          }

          // Build children
          let children: AXNode[] | undefined
          if ('children' in node) {
            const childNodes = (node as ChildrenMixin).children
              .map((child) => buildAXTree(child as SceneNode, depth + 1))
              .filter((n): n is AXNode => n !== null)
            if (childNodes.length > 0) {
              children = childNodes
            }
          }

          // === Compact mode: simplify tree ===
          if (compact) {
            // Skip generic wrappers with single child
            if (role === 'generic' && children?.length === 1 && !props.checked && !props.disabled) {
              return children[0]
            }

            // Flatten StaticText children into parent's name for buttons/links
            if (INTERACTIVE_ROLES.has(role) && !accessibleName && children) {
              const textChildren = children.filter((c) => c.role === 'StaticText')
              if (textChildren.length > 0) {
                accessibleName = textChildren.map((c) => c.name).join(' ')
                children = children.filter((c) => c.role !== 'StaticText')
                if (children.length === 0) children = undefined
              }
            }
          }

          const isInteractive = INTERACTIVE_ROLES.has(role)

          // Interactive filter mode
          if (interactive && !isInteractive) {
            const hasInteractiveDescendant = children?.some(
              (c) => c.ref || c.children?.some((cc) => cc.ref)
            )
            if (!hasInteractiveDescendant) {
              if (!children || children.length === 0) return null
              if (children.length === 1) return children[0]
            }
          }

          // Assign ref to interactive elements
          let ref: string | undefined
          if (isInteractive) {
            ref = `e${++refCounter}`
            refs[ref] = { id: node.id, role, name: accessibleName }
          }

          return {
            role,
            name: accessibleName,
            id: node.id,
            ref,
            props: Object.keys(props).length > 0 ? props : undefined,
            children
          }
        } catch (e) {
          // Skip nodes that cause errors (e.g., symbols, removed nodes)
          return null
        }
      }

      function formatTree(node: AXNode, indent = 0): string {
        const prefix = '  '.repeat(indent) + '- '
        let line = prefix + node.role

        if (node.name) line += ` "${node.name}"`
        if (node.id) line += ` [${node.id}]`
        if (node.ref) line += ` [ref=${node.ref}]`
        if (node.props) {
          const propParts: string[] = []
          if (node.props.level) propParts.push(`level=${node.props.level}`)
          if (node.props.rowCount && node.props.colCount) {
            propParts.push(`${node.props.rowCount}×${node.props.colCount}`)
          }
          if (node.props.itemCount) propParts.push(`${node.props.itemCount} items`)
          if (node.props.checked) propParts.push('checked')
          if (node.props.disabled) propParts.push('disabled')
          if (node.props.expanded) propParts.push('expanded')
          if (propParts.length > 0) line += ` [${propParts.join(', ')}]`
        }

        const lines = [line]
        if (node.children) {
          for (const child of node.children) {
            lines.push(formatTree(child, indent + 1))
          }
        }
        return lines.join('\n')
      }

      let rootNode: SceneNode | PageNode
      if (id) {
        const node = await figma.getNodeByIdAsync(id)
        if (!node || node.type === 'DOCUMENT') throw new Error(`Node ${id} not found`)
        rootNode = node as SceneNode
      } else {
        // Use selection or current page
        if (figma.currentPage.selection.length > 0) {
          rootNode = figma.currentPage.selection[0]
        } else {
          rootNode = figma.currentPage
        }
      }

      let tree: string
      if (rootNode.type === 'PAGE') {
        const pageChildren = (rootNode as PageNode).children
          .map((child) => buildAXTree(child as SceneNode, 0))
          .filter((n): n is AXNode => n !== null)
        tree = pageChildren.map((c) => formatTree(c, 0)).join('\n')
      } else {
        const snapshot = buildAXTree(rootNode as SceneNode, 0)
        tree = snapshot ? formatTree(snapshot, 0) : '(empty)'
      }

      return {
        tree,
        refs,
        refCount: refCounter
      }
    }

    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

async function appendToParent(node: SceneNode, parentId?: string, insertIndex?: number) {
  if (parentId) {
    const parent = await retry(
      () => figma.getNodeByIdAsync(parentId) as Promise<(FrameNode & ChildrenMixin) | null>,
      10,
      50
    )
    if (parent && 'appendChild' in parent) {
      if (insertIndex !== undefined && 'insertChild' in parent) {
        parent.insertChild(insertIndex, node)
      } else {
        parent.appendChild(node)
      }
      return
    }
    console.warn(`Parent ${parentId} not found after retries, appending to page`)
  }
  figma.currentPage.appendChild(node)
}

function serializeNode(node: BaseNode): object {
  const base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type
  }
  if (node.parent && node.parent.type !== 'PAGE') {
    base.parentId = node.parent.id
  }
  if ('x' in node) base.x = Math.round(node.x)
  if ('y' in node) base.y = Math.round(node.y)
  if ('width' in node) base.width = Math.round(node.width)
  if ('height' in node) base.height = Math.round(node.height)

  // Layout sizing for children in auto-layout
  if ('layoutSizingHorizontal' in node && node.layoutSizingHorizontal !== 'FIXED') {
    base.layoutSizingHorizontal = node.layoutSizingHorizontal
  }
  if ('layoutSizingVertical' in node && node.layoutSizingVertical !== 'FIXED') {
    base.layoutSizingVertical = node.layoutSizingVertical
  }

  // Only include non-default values
  if ('opacity' in node && node.opacity !== 1) base.opacity = node.opacity
  if ('visible' in node && !node.visible) base.visible = false
  if ('locked' in node && node.locked) base.locked = true

  // Serialize fills/strokes compactly
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    base.fills = node.fills.map(serializePaint)
  }
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    base.strokes = node.strokes.map(serializePaint)
  }
  if ('strokeWeight' in node && typeof node.strokeWeight === 'number' && node.strokeWeight > 0) {
    base.strokeWeight = node.strokeWeight
  }
  // Stroke align
  if ('strokeAlign' in node && node.strokeAlign !== 'CENTER') {
    base.strokeAlign = node.strokeAlign
  }
  // Individual stroke weights
  if ('strokeTopWeight' in node) {
    const sw = node.strokeWeight as number
    if (node.strokeTopWeight !== sw) base.strokeTopWeight = node.strokeTopWeight
    if ((node as FrameNode).strokeBottomWeight !== sw)
      base.strokeBottomWeight = (node as FrameNode).strokeBottomWeight
    if ((node as FrameNode).strokeLeftWeight !== sw)
      base.strokeLeftWeight = (node as FrameNode).strokeLeftWeight
    if ((node as FrameNode).strokeRightWeight !== sw)
      base.strokeRightWeight = (node as FrameNode).strokeRightWeight
  }
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    base.cornerRadius = node.cornerRadius
  }
  // Corner smoothing
  if (
    'cornerSmoothing' in node &&
    typeof node.cornerSmoothing === 'number' &&
    node.cornerSmoothing > 0
  ) {
    base.cornerSmoothing = node.cornerSmoothing
  }
  // Individual corner radii
  if ('topLeftRadius' in node) {
    const cr = node.cornerRadius as number
    const frame = node as FrameNode
    if (
      frame.topLeftRadius !== cr ||
      frame.topRightRadius !== cr ||
      frame.bottomLeftRadius !== cr ||
      frame.bottomRightRadius !== cr
    ) {
      base.topLeftRadius = frame.topLeftRadius
      base.topRightRadius = frame.topRightRadius
      base.bottomLeftRadius = frame.bottomLeftRadius
      base.bottomRightRadius = frame.bottomRightRadius
    }
  }
  // Blend mode
  if ('blendMode' in node && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    base.blendMode = node.blendMode
  }
  // Rotation
  if ('rotation' in node && node.rotation !== 0) {
    base.rotation = Math.round(node.rotation * 100) / 100
  }
  // Clips content
  if ('clipsContent' in node && node.clipsContent) {
    base.clipsContent = true
  }
  // Effects
  if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
    const visibleEffects = node.effects.filter((e: Effect) => e.visible !== false)
    if (visibleEffects.length > 0) {
      base.effects = visibleEffects.map((e: Effect) => {
        const effect: Record<string, unknown> = { type: e.type }
        if ('radius' in e) effect.radius = e.radius
        if ('color' in e && e.color) {
          effect.color = rgbToHex(e.color)
          if (e.color.a !== 1) effect.opacity = Math.round(e.color.a * 100) / 100
        }
        if ('offset' in e && e.offset) {
          effect.offset = { x: e.offset.x, y: e.offset.y }
        }
        if ('spread' in e) effect.spread = e.spread
        return effect
      })
    }
  }

  if ('componentPropertyDefinitions' in node) {
    try {
      base.componentPropertyDefinitions = node.componentPropertyDefinitions
    } catch {
      // Variant components throw when accessing componentPropertyDefinitions
    }
  }
  if ('componentProperties' in node) {
    base.componentProperties = node.componentProperties
  }

  // Layout properties for frames
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    base.layoutMode = node.layoutMode
    if ('itemSpacing' in node) base.itemSpacing = node.itemSpacing
    // Layout wrap
    if ('layoutWrap' in node && node.layoutWrap === 'WRAP') {
      base.layoutWrap = 'WRAP'
    }
    if ('primaryAxisSizingMode' in node) base.primaryAxisSizingMode = node.primaryAxisSizingMode
    if ('counterAxisSizingMode' in node) base.counterAxisSizingMode = node.counterAxisSizingMode
    if ('primaryAxisAlignItems' in node && node.primaryAxisAlignItems !== 'MIN') {
      base.primaryAxisAlignItems = node.primaryAxisAlignItems
    }
    if ('counterAxisAlignItems' in node && node.counterAxisAlignItems !== 'MIN') {
      base.counterAxisAlignItems = node.counterAxisAlignItems
    }
    if (
      'paddingLeft' in node &&
      (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom)
    ) {
      base.padding = {
        left: node.paddingLeft,
        right: node.paddingRight,
        top: node.paddingTop,
        bottom: node.paddingBottom
      }
    }
    // Grid layout properties
    if (node.layoutMode === 'GRID') {
      const gridNode = node as FrameNode
      if (gridNode.gridColumnGap !== undefined) base.gridColumnGap = gridNode.gridColumnGap
      if (gridNode.gridRowGap !== undefined) base.gridRowGap = gridNode.gridRowGap
      if (gridNode.gridColumnCount !== undefined) base.gridColumnCount = gridNode.gridColumnCount
      if (gridNode.gridRowCount !== undefined) base.gridRowCount = gridNode.gridRowCount
      if (gridNode.gridColumnSizes?.length > 0) base.gridColumnSizes = gridNode.gridColumnSizes
      if (gridNode.gridRowSizes?.length > 0) base.gridRowSizes = gridNode.gridRowSizes
    }
  }

  // Layout positioning (absolute)
  if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
    base.layoutPositioning = 'ABSOLUTE'
  }
  // Layout grow (flex-grow)
  if ('layoutGrow' in node && node.layoutGrow > 0) {
    base.layoutGrow = node.layoutGrow
  }
  // Layout align (stretch)
  if ('layoutAlign' in node && node.layoutAlign === 'STRETCH') {
    base.layoutAlign = 'STRETCH'
  }
  // Min/max constraints
  if ('minWidth' in node && node.minWidth !== null) base.minWidth = node.minWidth
  if ('maxWidth' in node && node.maxWidth !== null) base.maxWidth = node.maxWidth
  if ('minHeight' in node && node.minHeight !== null) base.minHeight = node.minHeight
  if ('maxHeight' in node && node.maxHeight !== null) base.maxHeight = node.maxHeight

  // Text properties
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    base.characters = textNode.characters
    if (typeof textNode.fontSize === 'number') base.fontSize = textNode.fontSize
    if (typeof textNode.fontName === 'object') {
      base.fontFamily = textNode.fontName.family
      base.fontStyle = textNode.fontName.style
    }
  }

  // Children count for containers
  if ('children' in node) {
    base.childCount = (node as ChildrenMixin).children.length
  }

  return base
}

function serializePaint(paint: Paint): object {
  if (paint.type === 'SOLID') {
    const result: Record<string, unknown> = {
      type: 'SOLID',
      color: rgbToHex(paint.color)
    }
    if (paint.opacity !== undefined && paint.opacity !== 1) result.opacity = paint.opacity
    return result
  }
  if (paint.type === 'IMAGE') {
    return { type: 'IMAGE', imageHash: paint.imageHash, scaleMode: paint.scaleMode }
  }
  if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    return {
      type: paint.type,
      stops: paint.gradientStops.map((s) => ({ color: rgbToHex(s.color), position: s.position }))
    }
  }
  return { type: paint.type }
}

function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, '0')
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, '0')
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${r}${g}${b}`.toUpperCase()
}

function expandHex(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    return clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
  }
  if (clean.length === 4) {
    return clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3]
  }
  return clean
}

function hexToRgb(hex: string): RGB {
  const clean = expandHex(hex)
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  }
}

/**
 * Parse color string - supports hex and variable references (var:Name or $Name)
 */
function parsestring(color: string): { hex?: string; variable?: string } {
  const varMatch = color.match(/^(?:var:|[$])(.+)$/)
  if (varMatch) {
    return { variable: varMatch[1] }
  }
  return { hex: color }
}

/**
 * Get hex color from color string (for sync operations, ignores variables)
 */
function getHexColor(color: string): string {
  const parsed = parsestring(color)
  return parsed.hex || '#000000'
}

/**
 * Create a solid paint from color string (hex or var:Name/$Name)
 */
async function createSolidPaint(color: string): Promise<SolidPaint> {
  const parsed = parsestring(color)

  if (parsed.hex) {
    return { type: 'SOLID', color: hexToRgb(parsed.hex) }
  }

  // Variable reference
  const variables = await figma.variables.getLocalVariablesAsync('COLOR')
  const variable = variables.find((v) => v.name === parsed.variable)

  if (!variable) {
    console.warn(`Variable "${parsed.variable}" not found, using black`)
    return { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }
  }

  const paint: SolidPaint = {
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0 } // Will be overridden by variable
  }

  return figma.variables.setBoundVariableForPaint(paint, 'color', variable)
}

function hexToRgba(hex: string): RGBA {
  const clean = expandHex(hex)
  const hasAlpha = clean.length === 8
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: hasAlpha ? parseInt(clean.slice(6, 8), 16) / 255 : 1
  }
}

function serializeVariable(v: Variable): object {
  return {
    id: v.id,
    name: v.name,
    type: v.resolvedType,
    collectionId: v.variableCollectionId,
    description: v.description || undefined,
    valuesByMode: Object.fromEntries(
      Object.entries(v.valuesByMode).map(([modeId, value]) => [
        modeId,
        serializeVariableValue(value, v.resolvedType)
      ])
    )
  }
}

function serializeCollection(c: VariableCollection): object {
  return {
    id: c.id,
    name: c.name,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    variableIds: c.variableIds
  }
}

function serializeVariableValue(value: VariableValue, type: string): unknown {
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
    return rgbToHex(value as RGB)
  }
  if (typeof value === 'object' && 'type' in value && (value as any).type === 'VARIABLE_ALIAS') {
    return { alias: (value as VariableAlias).id }
  }
  return value
}

function parseVariableValue(value: string, type: string): VariableValue {
  switch (type) {
    case 'COLOR':
      return hexToRgb(value)
    case 'FLOAT':
      return parseFloat(value)
    case 'BOOLEAN':
      return value === 'true'
    case 'STRING':
    default:
      return value
  }
}

// Convert svgpath segments to string with spaces (Figma requires spaces between commands)
function svgPathToString(sp: ReturnType<typeof svgpath>): string {
  return sp.segments.map((seg: (string | number)[]) => seg.join(' ')).join(' ')
}

// Expose RPC for CDP injection
declare const window: Window & { __figmaRpc?: typeof rpcHandler }

async function rpcHandler(command: string, args?: unknown): Promise<unknown> {
  if (!allPagesLoaded && NEEDS_ALL_PAGES.has(command)) {
    await figma.loadAllPagesAsync()
    allPagesLoaded = true
  }
  return handleCommand(command, args)
}

if (typeof window !== 'undefined') {
  window.__figmaRpc = rpcHandler
}
