console.log('[Figma Bridge] Plugin main loaded at', new Date().toISOString())

figma.showUI(__html__, { width: 300, height: 200 })

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
  deferredLayouts?: Array<{ frame: FrameNode; layoutMode: 'HORIZONTAL' | 'VERTICAL'; itemSpacing?: number; padding?: { top: number; right: number; bottom: number; left: number } }>
): Promise<SceneNode | null> {
  if (!args) return null
  
  const { x = 0, y = 0, width, height, name, parentId, fill, stroke, strokeWeight, radius, opacity,
          layoutMode, itemSpacing, padding, text, fontSize, fontFamily, fontStyle } = args as {
    x?: number; y?: number; width?: number; height?: number; name?: string; parentId?: string
    fill?: string; stroke?: string; strokeWeight?: number; radius?: number; opacity?: number
    layoutMode?: string; itemSpacing?: number; padding?: { top: number; right: number; bottom: number; left: number }
    text?: string; fontSize?: number; fontFamily?: string; fontStyle?: string
  }
  
  let node: SceneNode | null = null
  
  switch (command) {
    case 'create-frame': {
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(width || 100, height || 100)
      if (name) frame.name = name
      if (fill) frame.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) frame.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
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
      if (fill) rect.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) rect.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
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
      if (fill) ellipse.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
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
      if (fill) textNode.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
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
  'get-node-info', 'get-node-tree', 'get-node-children',
  'set-parent', 'clone-node', 'delete-node',
  'get-pages', 'set-current-page',
  'get-components', 'get-styles',
  'export-node', 'screenshot'
])

let allPagesLoaded = false

figma.ui.onmessage = async (msg: { type: string; id: string; command: string; args?: unknown }) => {
  if (msg.type !== 'command') return

  try {
    // Only load all pages when needed
    if (!allPagesLoaded && NEEDS_ALL_PAGES.has(msg.command)) {
      await figma.loadAllPagesAsync()
      allPagesLoaded = true
    }
    const result = await handleCommand(msg.command, msg.args)
    figma.ui.postMessage({ type: 'result', id: msg.id, result })
  } catch (error) {
    figma.ui.postMessage({ type: 'result', id: msg.id, error: String(error) })
  }
}

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
      const deferredLayouts: Array<{ frame: FrameNode; layoutMode: 'HORIZONTAL' | 'VERTICAL'; itemSpacing?: number; padding?: { top: number; right: number; bottom: number; left: number } }> = []
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
          const result = await handleCommand(cmd.command, cmd.args) as { id: string; name: string }
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

      for (const layout of deferredLayouts) {
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
          parent = await figma.getNodeByIdAsync(attachment.parentId) as SceneNode | null
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

    case 'get-current-page':
      return { id: figma.currentPage.id, name: figma.currentPage.name }

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
        
        // Only essential properties for tree view
        if ('fills' in n && Array.isArray(n.fills)) {
          const solid = n.fills.find((f: Paint) => f.type === 'SOLID') as SolidPaint | undefined
          if (solid) base.fills = [{ type: 'SOLID', color: rgbToHex(solid.color) }]
        }
        if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length > 0) {
          const solid = n.strokes.find((s: Paint) => s.type === 'SOLID') as SolidPaint | undefined
          if (solid) base.strokes = [{ type: 'SOLID', color: rgbToHex(solid.color) }]
        }
        if ('strokeWeight' in n && typeof n.strokeWeight === 'number' && n.strokeWeight > 0) {
          base.strokeWeight = n.strokeWeight
        }
        if ('cornerRadius' in n && typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
          base.cornerRadius = n.cornerRadius
        }
        if ('opacity' in n && n.opacity !== 1) base.opacity = n.opacity
        if ('visible' in n && !n.visible) base.visible = false
        if ('locked' in n && n.locked) base.locked = true
        if ('layoutMode' in n && n.layoutMode !== 'NONE') {
          base.layoutMode = n.layoutMode
          if ('itemSpacing' in n) base.itemSpacing = n.itemSpacing
        }
        if (n.type === 'TEXT') {
          const t = n as TextNode
          base.characters = t.characters
          if (typeof t.fontSize === 'number') base.fontSize = t.fontSize
          if (typeof t.fontName === 'object') {
            base.fontFamily = t.fontName.family
            base.fontStyle = t.fontName.style
          }
        }
        
        if ('children' in n && (n as FrameNode).children) {
          base.children = (n as FrameNode).children.map(serializeTreeNode)
        }
        return base
      }
      return serializeTreeNode(node)
    }

    case 'get-all-components': {
      const { name, limit = 50, page } = (args as { name?: string; limit?: number; page?: string }) || {}
      const components: object[] = []
      const nameLower = name?.toLowerCase()
      
      const searchNode = (node: SceneNode): boolean => {
        if (components.length >= limit) return false
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          if (!nameLower || node.name.toLowerCase().includes(nameLower)) {
            components.push(serializeNode(node))
          }
        }
        if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            if (!searchNode(child)) return false
          }
        }
        return components.length < limit
      }
      
      const pages = page 
        ? figma.root.children.filter(p => p.id === page || p.name === page || p.name.includes(page))
        : figma.root.children
      
      for (const pageNode of pages) {
        if (components.length >= limit) break
        for (const child of pageNode.children) {
          if (!searchNode(child)) break
        }
      }
      return components
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
      const byId = await figma.getNodeByIdAsync(pageArg) as PageNode | null
      if (byId && byId.type === 'PAGE') {
        page = byId
      } else {
        // Try by name
        page = figma.root.children.find(p => p.name === pageArg || p.name.includes(pageArg)) || null
      }
      
      if (!page) throw new Error('Page not found')
      await figma.setCurrentPageAsync(page)
      return { id: page.id, name: page.name }
    }

    case 'get-local-styles': {
      const { type } = args as { type?: string } || {}
      const result: Record<string, object[]> = {}
      if (!type || type === 'all' || type === 'paint') {
        const styles = await figma.getLocalPaintStylesAsync()
        if (styles.length > 0) {
          result.paintStyles = styles.map(s => ({
            id: s.id, name: s.name, paints: s.paints.map(serializePaint)
          }))
        }
      }
      if (!type || type === 'all' || type === 'text') {
        const styles = await figma.getLocalTextStylesAsync()
        if (styles.length > 0) {
          result.textStyles = styles.map(s => ({
            id: s.id, name: s.name, fontSize: s.fontSize, fontFamily: s.fontName.family, fontStyle: s.fontName.style
          }))
        }
      }
      if (!type || type === 'all' || type === 'effect') {
        const styles = await figma.getLocalEffectStylesAsync()
        if (styles.length > 0) {
          result.effectStyles = styles.map(s => ({
            id: s.id, name: s.name, effects: s.effects.map(e => ({ type: e.type, radius: 'radius' in e ? e.radius : undefined }))
          }))
        }
      }
      if (!type || type === 'all' || type === 'grid') {
        const styles = await figma.getLocalGridStylesAsync()
        if (styles.length > 0) {
          result.gridStyles = styles.map(s => ({
            id: s.id, name: s.name, grids: s.layoutGrids.length
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
      const { x, y, width, height, name, parentId, fill, stroke, strokeWeight, radius, opacity } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
        fill?: string; stroke?: string; strokeWeight?: number; radius?: number; opacity?: number
      }
      const rect = figma.createRectangle()
      rect.x = x
      rect.y = y
      rect.resize(width, height)
      if (name) rect.name = name
      if (fill) rect.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) rect.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
      if (strokeWeight !== undefined) rect.strokeWeight = strokeWeight
      if (radius !== undefined) rect.cornerRadius = radius
      if (opacity !== undefined) rect.opacity = opacity
      await appendToParent(rect, parentId)
      return serializeNode(rect)
    }

    case 'create-ellipse': {
      const { x, y, width, height, name, parentId, fill, stroke, strokeWeight, opacity } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
        fill?: string; stroke?: string; strokeWeight?: number; opacity?: number
      }
      const ellipse = figma.createEllipse()
      ellipse.x = x
      ellipse.y = y
      ellipse.resize(width, height)
      if (name) ellipse.name = name
      if (fill) ellipse.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
      if (strokeWeight !== undefined) ellipse.strokeWeight = strokeWeight
      if (opacity !== undefined) ellipse.opacity = opacity
      await appendToParent(ellipse, parentId)
      return serializeNode(ellipse)
    }

    case 'create-line': {
      const { x, y, length, rotation, name, parentId } = args as {
        x: number; y: number; length: number; rotation?: number; name?: string; parentId?: string
      }
      const line = figma.createLine()
      line.x = x
      line.y = y
      line.resize(length, 0)
      if (rotation) line.rotation = rotation
      if (name) line.name = name
      await appendToParent(line, parentId)
      return serializeNode(line)
    }

    case 'create-polygon': {
      const { x, y, size, sides, name, parentId } = args as {
        x: number; y: number; size: number; sides?: number; name?: string; parentId?: string
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
        x: number; y: number; size: number; points?: number; innerRadius?: number; name?: string; parentId?: string
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
        x: number; y: number; path: string; name?: string; parentId?: string
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
      const { x, y, width, height, name, parentId, fill, stroke, strokeWeight, radius, opacity, layoutMode, itemSpacing, padding } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
        fill?: string; stroke?: string; strokeWeight?: number; radius?: number; opacity?: number
        layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE'; itemSpacing?: number
        padding?: { top: number; right: number; bottom: number; left: number }
      }
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(width, height)
      if (name) frame.name = name
      if (fill) frame.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (stroke) frame.strokes = [{ type: 'SOLID', color: hexToRgb(stroke) }]
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
        x: number; y: number; width: number; height: number; name?: string
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
        x: number; y: number; width: number; height: number; name?: string
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
      const { x, y, text, fontSize, fontFamily, fontStyle, fill, opacity, name, parentId } = args as {
        x: number; y: number; text: string; fontSize?: number; fontFamily?: string
        fontStyle?: string; fill?: string; opacity?: number; name?: string; parentId?: string
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
      if (fill) textNode.fills = [{ type: 'SOLID', color: hexToRgb(fill) }]
      if (opacity !== undefined) textNode.opacity = opacity
      if (name) textNode.name = name
      await appendToParent(textNode, parentId)
      return serializeNode(textNode)
    }

    case 'create-instance': {
      const { componentId, x, y, name, parentId } = args as {
        componentId: string; x?: number; y?: number; name?: string; parentId?: string
      }
      const component = await figma.getNodeByIdAsync(componentId) as ComponentNode | null
      if (!component || component.type !== 'COMPONENT') throw new Error('Component not found')
      const instance = component.createInstance()
      if (x !== undefined) instance.x = x
      if (y !== undefined) instance.y = y
      if (name) instance.name = name
      await appendToParent(instance, parentId)
      return serializeNode(instance)
    }

    case 'create-component': {
      const { name, parentId } = args as { name: string; parentId?: string }
      const component = figma.createComponent()
      component.name = name
      await appendToParent(component, parentId)
      return serializeNode(component)
    }

    case 'clone-node': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('clone' in node)) throw new Error('Node not found')
      const clone = node.clone()
      return serializeNode(clone)
    }

    // ==================== CREATE STYLES ====================
    case 'create-paint-style': {
      const { name, color } = args as { name: string; color: string }
      const style = figma.createPaintStyle()
      style.name = name
      style.paints = [{ type: 'SOLID', color: hexToRgb(color) }]
      return { id: style.id, name: style.name, key: style.key }
    }

    case 'create-text-style': {
      const { name, fontFamily, fontStyle, fontSize } = args as {
        name: string; fontFamily?: string; fontStyle?: string; fontSize?: number
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
        name: string; type: string; radius?: number; color?: string; offsetX?: number; offsetY?: number
      }
      const style = figma.createEffectStyle()
      style.name = name
      const rgba = color ? hexToRgba(color) : { r: 0, g: 0, b: 0, a: 0.25 }
      if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
        style.effects = [{
          type: type as 'DROP_SHADOW' | 'INNER_SHADOW',
          color: rgba,
          offset: { x: offsetX || 0, y: offsetY || 4 },
          radius: radius || 10,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }]
      } else if (type === 'BLUR' || type === 'BACKGROUND_BLUR') {
        style.effects = [{
          type: type as 'LAYER_BLUR' | 'BACKGROUND_BLUR',
          blurType: 'NORMAL',
          radius: radius || 10,
          visible: true
        } as BlurEffect]
      }
      return { id: style.id, name: style.name, key: style.key }
    }

    // ==================== UPDATE POSITION/SIZE ====================
    case 'move-node': {
      const { id, x, y } = args as { id: string; x: number; y: number }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.x = x
      node.y = y
      return serializeNode(node)
    }

    case 'resize-node': {
      const { id, width, height } = args as { id: string; width: number; height: number }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('resize' in node)) throw new Error('Node not found')
      node.resize(width, height)
      return serializeNode(node)
    }

    // ==================== UPDATE APPEARANCE ====================
    case 'set-fill-color': {
      const { id, color } = args as { id: string; color: string }
      const node = await figma.getNodeByIdAsync(id) as GeometryMixin | null
      if (!node || !('fills' in node)) throw new Error('Node not found')
      node.fills = [{ type: 'SOLID', color: hexToRgb(color) }]
      return serializeNode(node as BaseNode)
    }

    case 'set-stroke-color': {
      const { id, color, weight, align } = args as { id: string; color: string; weight?: number; align?: string }
      const node = await figma.getNodeByIdAsync(id) as GeometryMixin | null
      if (!node || !('strokes' in node)) throw new Error('Node not found')
      node.strokes = [{ type: 'SOLID', color: hexToRgb(color) }]
      if (weight !== undefined && 'strokeWeight' in node) (node as any).strokeWeight = weight
      if (align && 'strokeAlign' in node) (node as any).strokeAlign = align as 'INSIDE' | 'OUTSIDE' | 'CENTER'
      return serializeNode(node as BaseNode)
    }

    case 'set-corner-radius': {
      const { id, cornerRadius, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius } = args as {
        id: string; cornerRadius: number; topLeftRadius?: number; topRightRadius?: number
        bottomLeftRadius?: number; bottomRightRadius?: number
      }
      const node = await figma.getNodeByIdAsync(id) as RectangleNode | null
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
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('opacity' in node)) throw new Error('Node not found')
      node.opacity = opacity
      return serializeNode(node)
    }

    case 'set-image-fill': {
      const { id, url, scaleMode } = args as { id: string; url: string; scaleMode?: string }
      const node = await figma.getNodeByIdAsync(id) as GeometryMixin | null
      if (!node || !('fills' in node)) throw new Error('Node not found')
      const image = await figma.createImageAsync(url)
      node.fills = [{
        type: 'IMAGE',
        imageHash: image.hash,
        scaleMode: (scaleMode || 'FILL') as 'FILL' | 'FIT' | 'CROP' | 'TILE'
      }]
      return serializeNode(node as BaseNode)
    }

    // ==================== UPDATE PROPERTIES ====================
    case 'rename-node': {
      const { id, name } = args as { id: string; name: string }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.name = name
      return serializeNode(node)
    }

    case 'set-visible': {
      const { id, visible } = args as { id: string; visible: boolean }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.visible = visible
      return serializeNode(node)
    }

    case 'set-locked': {
      const { id, locked } = args as { id: string; locked: boolean }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      node.locked = locked
      return serializeNode(node)
    }

    case 'set-effect': {
      const { id, type, color, offsetX, offsetY, radius, spread } = args as {
        id: string; type: string; color?: string; offsetX?: number; offsetY?: number; radius?: number; spread?: number
      }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('effects' in node)) throw new Error('Node not found')
      const rgba = color ? hexToRgba(color) : { r: 0, g: 0, b: 0, a: 0.25 }
      if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
        node.effects = [{
          type: type as 'DROP_SHADOW' | 'INNER_SHADOW',
          color: rgba,
          offset: { x: offsetX ?? 0, y: offsetY ?? 4 },
          radius: radius ?? 8,
          spread: spread ?? 0,
          visible: true,
          blendMode: 'NORMAL'
        }]
      } else if (type === 'BLUR') {
        node.effects = [{
          type: 'LAYER_BLUR',
          blurType: 'NORMAL',
          radius: radius ?? 8,
          visible: true
        } as BlurEffect]
      }
      return serializeNode(node)
    }

    case 'set-text': {
      const { id, text } = args as { id: string; text: string }
      const node = await figma.getNodeByIdAsync(id) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      const fontName = node.fontName as FontName
      await loadFont(fontName.family, fontName.style)
      node.characters = text
      return serializeNode(node)
    }

    case 'import-svg': {
      const { svg, x, y, name, parentId } = args as {
        svg: string; x?: number; y?: number; name?: string; parentId?: string
      }
      const node = figma.createNodeFromSvg(svg)
      if (x !== undefined) node.x = x
      if (y !== undefined) node.y = y
      if (name) node.name = name
      await appendToParent(node, parentId)
      return serializeNode(node)
    }

    case 'set-font': {
      const { id, fontFamily, fontStyle, fontSize } = args as {
        id: string; fontFamily?: string; fontStyle?: string; fontSize?: number
      }
      const node = await figma.getNodeByIdAsync(id) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      const currentFont = node.fontName as FontName
      const family = fontFamily || currentFont.family
      const style = fontStyle || currentFont.style
      await loadFont(family, style)
      node.fontName = { family, style }
      if (fontSize !== undefined) node.fontSize = fontSize
      return serializeNode(node)
    }

    case 'get-children': {
      const { id, depth } = args as { id: string; depth?: number }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('children' in node)) return []
      const maxDepth = depth || 1
      const serializeWithDepth = (n: SceneNode, d: number): object => {
        const base = serializeNode(n) as Record<string, unknown>
        if (d < maxDepth && 'children' in n) {
          base.children = (n as FrameNode).children.map(c => serializeWithDepth(c, d + 1))
        }
        return base
      }
      return (node as FrameNode).children.map(c => serializeWithDepth(c, 1))
    }

    case 'find-by-name': {
      const { name, type, exact, limit = 100 } = args as { name?: string; type?: string; exact?: boolean; limit?: number }
      const results: object[] = []
      const nameLower = name?.toLowerCase()
      
      const searchNode = (node: SceneNode): boolean => {
        if (results.length >= limit) return false
        const nameMatch = !nameLower || (exact ? node.name === name : node.name.toLowerCase().includes(nameLower))
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
      const nodes = await Promise.all(ids.map(id => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'id' in n)
      figma.currentPage.selection = validNodes
      return { selected: validNodes.length }
    }

    case 'set-constraints': {
      const { id, horizontal, vertical } = args as {
        id: string; horizontal?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
        vertical?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE'
      }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('constraints' in node)) throw new Error('Node not found')
      node.constraints = {
        horizontal: horizontal || node.constraints.horizontal,
        vertical: vertical || node.constraints.vertical
      }
      return serializeNode(node)
    }

    case 'set-blend-mode': {
      const { id, mode } = args as { id: string; mode: BlendMode }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('blendMode' in node)) throw new Error('Node not found')
      node.blendMode = mode
      return serializeNode(node)
    }

    case 'set-auto-layout': {
      const { id, mode, wrap, itemSpacing, counterSpacing, padding, primaryAlign, counterAlign, sizingH, sizingV } = args as {
        id: string; mode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE'; wrap?: boolean
        itemSpacing?: number; counterSpacing?: number
        padding?: { top: number; right: number; bottom: number; left: number }
        primaryAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
        counterAlign?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
        sizingH?: 'FIXED' | 'HUG' | 'FILL'; sizingV?: 'FIXED' | 'HUG' | 'FILL'
      }
      const node = await figma.getNodeByIdAsync(id) as FrameNode | null
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
      return serializeNode(node)
    }

    case 'set-layout-child': {
      const { id, horizontalSizing, verticalSizing, positioning, x, y } = args as {
        id: string; horizontalSizing?: 'FIXED' | 'FILL' | 'HUG'; verticalSizing?: 'FIXED' | 'FILL' | 'HUG'
        positioning?: 'AUTO' | 'ABSOLUTE'; x?: number; y?: number
      }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (horizontalSizing && 'layoutSizingHorizontal' in node) {
        (node as FrameNode).layoutSizingHorizontal = horizontalSizing
      }
      if (verticalSizing && 'layoutSizingVertical' in node) {
        (node as FrameNode).layoutSizingVertical = verticalSizing
      }
      if (positioning && 'layoutPositioning' in node) {
        (node as FrameNode).layoutPositioning = positioning
      }
      if (positioning === 'ABSOLUTE') {
        if (x !== undefined) node.x = x
        if (y !== undefined) node.y = y
      }
      return serializeNode(node)
    }

    case 'set-text-properties': {
      const { id, lineHeight, letterSpacing, textAlign, verticalAlign, autoResize, maxLines, paragraphSpacing, paragraphIndent } = args as {
        id: string; lineHeight?: number | 'auto'; letterSpacing?: number
        textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
        verticalAlign?: 'TOP' | 'CENTER' | 'BOTTOM'
        autoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE'
        maxLines?: number; paragraphSpacing?: number; paragraphIndent?: number
      }
      const node = await figma.getNodeByIdAsync(id) as TextNode | null
      if (!node || node.type !== 'TEXT') throw new Error('Text node not found')
      
      const fontName = node.fontName as FontName
      await loadFont(fontName.family, fontName.style)
      
      if (lineHeight !== undefined) {
        node.lineHeight = lineHeight === 'auto' 
          ? { unit: 'AUTO' } 
          : { unit: 'PIXELS', value: lineHeight }
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
        id: string; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number
      }
      const node = await figma.getNodeByIdAsync(id) as FrameNode | null
      if (!node) throw new Error('Node not found')
      if (minWidth !== undefined && 'minWidth' in node) node.minWidth = minWidth
      if (maxWidth !== undefined && 'maxWidth' in node) node.maxWidth = maxWidth
      if (minHeight !== undefined && 'minHeight' in node) node.minHeight = minHeight
      if (maxHeight !== undefined && 'maxHeight' in node) node.maxHeight = maxHeight
      return serializeNode(node)
    }

    case 'set-rotation': {
      const { id, angle } = args as { id: string; angle: number }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if ('rotation' in node) node.rotation = angle
      return serializeNode(node)
    }

    case 'set-stroke-align': {
      const { id, align } = args as { id: string; align: 'INSIDE' | 'OUTSIDE' | 'CENTER' }
      const node = await figma.getNodeByIdAsync(id) as GeometryMixin | null
      if (!node || !('strokeAlign' in node)) throw new Error('Node not found')
      node.strokeAlign = align
      return serializeNode(node as BaseNode)
    }

    // ==================== UPDATE STRUCTURE ====================
    case 'set-layout': {
      const { id, mode, wrap, clip, itemSpacing, primaryAxisAlignItems, counterAxisAlignItems,
        paddingLeft, paddingRight, paddingTop, paddingBottom, layoutSizingVertical, layoutSizingHorizontal
      } = args as {
        id: string; mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'; wrap?: boolean; clip?: boolean
        itemSpacing?: number; primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'
        counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'
        paddingLeft?: number; paddingRight?: number; paddingTop?: number; paddingBottom?: number
        layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL'; layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL'
      }
      const node = await figma.getNodeByIdAsync(id) as FrameNode | null
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
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      const parent = await figma.getNodeByIdAsync(parentId) as (FrameNode & ChildrenMixin) | null
      if (!node || !parent) throw new Error('Node or parent not found')
      parent.appendChild(node)
      return serializeNode(node)
    }

    case 'group-nodes': {
      const { ids, name } = args as { ids: string[]; name?: string }
      const nodes = await Promise.all(ids.map(id => figma.getNodeByIdAsync(id)))
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
      const node = await figma.getNodeByIdAsync(id) as GroupNode | null
      if (!node || node.type !== 'GROUP') throw new Error('Not a group node')
      const children = figma.ungroup(node)
      return children.map(serializeNode)
    }

    case 'flatten-nodes': {
      const { ids } = args as { ids: string[] }
      const nodes = await Promise.all(ids.map(id => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'parent' in n)
      if (validNodes.length === 0) throw new Error('No valid nodes found')
      const vector = figma.flatten(validNodes)
      return serializeNode(vector)
    }

    // ==================== BOOLEAN OPERATIONS ====================
    case 'boolean-operation': {
      const { ids, operation } = args as { ids: string[]; operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE' }
      const nodes = await Promise.all(ids.map(id => figma.getNodeByIdAsync(id)))
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && 'parent' in n)
      if (validNodes.length < 2) throw new Error('Need at least 2 nodes')
      const parent = validNodes[0].parent
      if (!parent || !('children' in parent)) throw new Error('Invalid parent')
      let result: BooleanOperationNode
      switch (operation) {
        case 'UNION': result = figma.union(validNodes, parent); break
        case 'SUBTRACT': result = figma.subtract(validNodes, parent); break
        case 'INTERSECT': result = figma.intersect(validNodes, parent); break
        case 'EXCLUDE': result = figma.exclude(validNodes, parent); break
      }
      return serializeNode(result)
    }

    // ==================== INSTANCE/COMPONENT ====================
    case 'set-instance-properties': {
      const { instanceId, properties } = args as { instanceId: string; properties: Record<string, unknown> }
      const instance = await figma.getNodeByIdAsync(instanceId) as InstanceNode | null
      if (!instance || instance.type !== 'INSTANCE') throw new Error('Instance not found')
      instance.setProperties(properties as { [key: string]: string | boolean })
      return serializeNode(instance)
    }

    case 'set-node-component-property-references': {
      const { id, componentPropertyReferences } = args as { id: string; componentPropertyReferences: Record<string, string> }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
      if (!node || !('componentPropertyReferences' in node)) throw new Error('Node not found')
      for (const [key, value] of Object.entries(componentPropertyReferences)) {
        node.componentPropertyReferences = { ...node.componentPropertyReferences, [key]: value }
      }
      return serializeNode(node)
    }

    case 'add-component-property': {
      const { componentId, name, type, defaultValue } = args as {
        componentId: string; name: string; type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT'
        defaultValue: string | boolean
      }
      const component = await figma.getNodeByIdAsync(componentId) as ComponentNode | ComponentSetNode | null
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
        componentId: string; name: string; defaultValue: string | boolean; preferredValues?: string[]
      }
      const component = await figma.getNodeByIdAsync(componentId) as ComponentNode | ComponentSetNode | null
      if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) {
        throw new Error('Component not found')
      }
      const props = component.componentPropertyDefinitions
      const propKey = Object.keys(props).find((k) => k === name || k.startsWith(name + '#'))
      if (!propKey) throw new Error('Property not found')
      const propDef = props[propKey]
      let parsedDefault: string | boolean = defaultValue
      if (propDef.type === 'BOOLEAN') parsedDefault = defaultValue === 'true' || defaultValue === true
      component.editComponentProperty(propKey, {
        name,
        defaultValue: parsedDefault,
        preferredValues: preferredValues?.map((v) => ({ type: 'COMPONENT', key: v }))
      })
      return serializeNode(component)
    }

    case 'delete-component-property': {
      const { componentId, name } = args as { componentId: string; name: string }
      const component = await figma.getNodeByIdAsync(componentId) as ComponentNode | ComponentSetNode | null
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
        const fetched = await Promise.all(ids.map(id => figma.getNodeByIdAsync(id)))
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
      const { id, format, scale } = args as { id: string; format: 'PNG' | 'JPG' | 'SVG' | 'PDF'; scale?: number }
      const node = await figma.getNodeByIdAsync(id) as SceneNode | null
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

      // Clone visible nodes that intersect viewport
      for (const node of figma.currentPage.children) {
        if (node.id === frame.id) continue
        if (!node.visible) continue
        if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
          const nb = node.absoluteBoundingBox
          if (nb.x + nb.width > bounds.x && nb.x < bounds.x + bounds.width &&
              nb.y + nb.height > bounds.y && nb.y < bounds.y + bounds.height) {
            const clone = node.clone()
            clone.x = node.x - bounds.x
            clone.y = node.y - bounds.y
            frame.appendChild(clone)
          }
        }
      }

      const bytes = await frame.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale || 1 } })
      frame.remove()
      return { data: figma.base64Encode(bytes) }
    }

    case 'export-selection': {
      const { format, scale, padding } = args as { format?: 'PNG' | 'JPG' | 'SVG' | 'PDF'; scale?: number; padding?: number }
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
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
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
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || !('remove' in node)) throw new Error('Node not found')
      node.remove()
      return { deleted: true }
    }

    // ==================== EVAL ====================
    case 'eval': {
      const { code } = args as { code: string }
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
      // Wrap code to support top-level await
      const wrappedCode = code.trim().startsWith('return') 
        ? code 
        : `return (async () => { ${code} })()`
      const fn = new AsyncFunction('figma', wrappedCode)
      return await fn(figma)
    }
    
    // ==================== LAYOUT ====================
    case 'trigger-layout': {
      // Trigger auto-layout recalculation for a node and all descendants
      // Multiplayer protocol creates nodes but doesn't trigger layout engine
      const { nodeId } = args as { nodeId: string }
      const root = await figma.getNodeByIdAsync(nodeId)
      if (!root) return null
      
      // Recursively trigger layout for all frames with auto-layout
      const triggerRecursive = (node: SceneNode) => {
        if ('layoutMode' in node && node.layoutMode !== 'NONE' && 'resize' in node) {
          const w = node.width
          const h = node.height
          node.resize(w + 0.01, h + 0.01)
          node.resize(w, h)
        }
        if ('children' in node) {
          for (const child of node.children) {
            triggerRecursive(child)
          }
        }
      }
      
      triggerRecursive(root as SceneNode)
      return { triggered: true }
    }

    // ==================== VARIABLES ====================
    case 'get-variables': {
      const { type, simple } = args as { type?: string; simple?: boolean }
      const variables = await figma.variables.getLocalVariablesAsync(type as VariableResolvedDataType | undefined)
      // Simple mode returns only id and name (for variable registry)
      if (simple) {
        return variables.map(v => ({ id: v.id, name: v.name }))
      }
      return variables.map(v => serializeVariable(v))
    }

    case 'get-variable': {
      const { id } = args as { id: string }
      const variable = await figma.variables.getVariableByIdAsync(id)
      if (!variable) throw new Error('Variable not found')
      return serializeVariable(variable)
    }

    case 'create-variable': {
      const { name, collectionId, type, value } = args as { name: string; collectionId: string; type: string; value?: string }
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId)
      if (!collection) throw new Error('Collection not found')
      const variable = figma.variables.createVariable(name, collection, type as VariableResolvedDataType)
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
      const { nodeId, field, variableId } = args as { nodeId: string; field: string; variableId: string }
      const node = await figma.getNodeByIdAsync(nodeId) as SceneNode | null
      if (!node) throw new Error('Node not found')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      if ('setBoundVariable' in node) {
        (node as any).setBoundVariable(field, variable)
      } else {
        throw new Error('Node does not support variable binding')
      }
      return serializeNode(node)
    }

    case 'bind-fill-variable': {
      const { nodeId, variableId, paintIndex = 0 } = args as { nodeId: string; variableId: string; paintIndex?: number }
      const node = await figma.getNodeByIdAsync(nodeId) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('fills' in node)) throw new Error('Node does not have fills')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      const fills = (node as GeometryMixin).fills as Paint[]
      if (!fills[paintIndex]) throw new Error('Paint not found at index ' + paintIndex)
      const newFill = figma.variables.setBoundVariableForPaint(fills[paintIndex], 'color', variable)
      ;(node as GeometryMixin).fills = [...fills.slice(0, paintIndex), newFill, ...fills.slice(paintIndex + 1)]
      return serializeNode(node)
    }

    case 'bind-stroke-variable': {
      const { nodeId, variableId, paintIndex = 0 } = args as { nodeId: string; variableId: string; paintIndex?: number }
      const node = await figma.getNodeByIdAsync(nodeId) as SceneNode | null
      if (!node) throw new Error('Node not found')
      if (!('strokes' in node)) throw new Error('Node does not have strokes')
      const variable = await figma.variables.getVariableByIdAsync(variableId)
      if (!variable) throw new Error('Variable not found')
      const strokes = (node as GeometryMixin).strokes as Paint[]
      if (!strokes[paintIndex]) throw new Error('Paint not found at index ' + paintIndex)
      const newStroke = figma.variables.setBoundVariableForPaint(strokes[paintIndex], 'color', variable)
      ;(node as GeometryMixin).strokes = [...strokes.slice(0, paintIndex), newStroke, ...strokes.slice(paintIndex + 1)]
      return serializeNode(node)
    }

    // ==================== VARIABLE COLLECTIONS ====================
    case 'get-variable-collections': {
      const collections = await figma.variables.getLocalVariableCollectionsAsync()
      return collections.map(c => serializeCollection(c))
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

    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

async function appendToParent(node: SceneNode, parentId?: string) {
  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId) as (FrameNode & ChildrenMixin) | null
    if (parent && 'appendChild' in parent) {
      parent.appendChild(node)
      return
    }
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
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    base.cornerRadius = node.cornerRadius
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
    if ('paddingLeft' in node && (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom)) {
      base.padding = { left: node.paddingLeft, right: node.paddingRight, top: node.paddingTop, bottom: node.paddingBottom }
    }
  }

  // Text properties
  if (node.type === 'TEXT') {
    const textNode = node as TextNode
    base.characters = textNode.characters
    if (typeof textNode.fontSize === 'number') base.fontSize = textNode.fontSize
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
  if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_ANGULAR' || paint.type === 'GRADIENT_DIAMOND') {
    return {
      type: paint.type,
      stops: paint.gradientStops.map(s => ({ color: rgbToHex(s.color), position: s.position }))
    }
  }
  return { type: paint.type }
}

function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0')
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
    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
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
