console.log('[Figma Bridge] Plugin main loaded at', new Date().toISOString())

figma.showUI(__html__, { width: 300, height: 200 })

figma.ui.onmessage = async (msg: { type: string; id: string; command: string; args?: unknown }) => {
  if (msg.type !== 'command') return

  try {
    await figma.loadAllPagesAsync()
    const result = await handleCommand(msg.command, msg.args)
    figma.ui.postMessage({ type: 'result', id: msg.id, result })
  } catch (error) {
    figma.ui.postMessage({ type: 'result', id: msg.id, error: String(error) })
  }
}

async function handleCommand(command: string, args?: unknown): Promise<unknown> {
  switch (command) {
    // ==================== READ ====================
    case 'get-selection':
      return figma.currentPage.selection.map(serializeNode)

    case 'get-node-info': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      return node ? serializeNode(node) : null
    }

    case 'get-all-components': {
      const components: object[] = []
      figma.root.findAll((node) => {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          components.push(serializeNode(node))
        }
        return false
      })
      return components
    }

    case 'get-pages':
      return figma.root.children.map((page) => ({ id: page.id, name: page.name }))

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
            id: s.id, name: s.name, effects: s.effects.map(e => ({ type: e.type, radius: e.radius }))
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
      const { x, y, width, height, name, parentId } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
      }
      const rect = figma.createRectangle()
      rect.x = x
      rect.y = y
      rect.resize(width, height)
      if (name) rect.name = name
      await appendToParent(rect, parentId)
      return serializeNode(rect)
    }

    case 'create-ellipse': {
      const { x, y, width, height, name, parentId } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
      }
      const ellipse = figma.createEllipse()
      ellipse.x = x
      ellipse.y = y
      ellipse.resize(width, height)
      if (name) ellipse.name = name
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
      const { x, y, width, height, name, parentId } = args as {
        x: number; y: number; width: number; height: number; name?: string; parentId?: string
      }
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(width, height)
      if (name) frame.name = name
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
      const { x, y, text, fontSize, fontName, fontWeight, fontColor, name, parentId } = args as {
        x: number; y: number; text: string; fontSize?: number; fontName?: string
        fontWeight?: number; fontColor?: string; name?: string; parentId?: string
      }
      const textNode = figma.createText()
      await figma.loadFontAsync({ family: fontName || 'Inter', style: fontWeight === 700 ? 'Bold' : 'Regular' })
      textNode.x = x
      textNode.y = y
      textNode.characters = text
      if (fontSize) textNode.fontSize = fontSize
      if (fontColor) textNode.fills = [{ type: 'SOLID', color: hexToRgb(fontColor) }]
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
      await figma.loadFontAsync({ family: fontFamily || 'Inter', style: fontStyle || 'Regular' })
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
          radius: radius || 10,
          visible: true
        }]
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
      const { id, color } = args as { id: string; color: string }
      const node = await figma.getNodeByIdAsync(id) as GeometryMixin | null
      if (!node || !('strokes' in node)) throw new Error('Node not found')
      node.strokes = [{ type: 'SOLID', color: hexToRgb(color) }]
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

    // ==================== UPDATE STRUCTURE ====================
    case 'set-layout': {
      const { id, mode, wrap, clip, itemSpacing, primaryAxisAlignItems, counterAxisAlignItems,
        paddingLeft, paddingRight, paddingTop, paddingBottom, layoutSizingVertical, layoutSizingHorizontal
      } = args as {
        id: string; mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL'; wrap?: boolean; clip?: boolean
        itemSpacing?: number; primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'
        counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'
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

    // ==================== DELETE ====================
    case 'delete-node': {
      const { id } = args as { id: string }
      const node = await figma.getNodeByIdAsync(id)
      if (!node || !('remove' in node)) throw new Error('Node not found')
      node.remove()
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

  if ('componentPropertyDefinitions' in node) {
    base.componentPropertyDefinitions = node.componentPropertyDefinitions
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

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  }
}

function hexToRgba(hex: string): RGBA {
  const clean = hex.replace('#', '')
  const hasAlpha = clean.length === 8
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
    a: hasAlpha ? parseInt(clean.slice(6, 8), 16) / 255 : 1
  }
}
