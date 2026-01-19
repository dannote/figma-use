import { evaluateXPathToNodes, evaluateXPathToBoolean } from 'fontoxpath'

const NODE_TYPES = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  TEXT_NODE: 3,
  DOCUMENT_NODE: 9,
}

interface FigmaDocument {
  nodeType: number
  nodeName: string
  documentElement: FigmaNode
  _children?: FigmaNode[]
}

const QUERYABLE_ATTRS = [
  'name', 'width', 'height', 'x', 'y', 'visible', 'opacity',
  'cornerRadius', 'characters', 'fontSize', 'layoutMode', 
  'itemSpacing', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'strokeWeight', 'rotation', 'constrainProportions',
]

interface FigmaAttr {
  nodeType: number
  nodeName: string
  name: string
  localName: string
  namespaceURI: null
  prefix: null
  value: string
  ownerElement: FigmaNode
}

interface FigmaNode {
  nodeType: number
  nodeName: string
  localName: string
  namespaceURI: null
  prefix: null
  _figmaNode: SceneNode | PageNode
  _attrs?: FigmaAttr[]
  _parent?: FigmaNode | null
  _children?: FigmaNode[]
}

function wrapNode(node: SceneNode | PageNode, parent?: FigmaNode | FigmaDocument | null): FigmaNode {
  const wrapped: FigmaNode = {
    nodeType: NODE_TYPES.ELEMENT_NODE,
    nodeName: node.type,
    localName: node.type,
    namespaceURI: null,
    prefix: null,
    _figmaNode: node,
    _parent: parent as FigmaNode | null,
  }
  return wrapped
}

function createDocument(rootNode: SceneNode | PageNode): FigmaDocument {
  const doc: FigmaDocument = {
    nodeType: NODE_TYPES.DOCUMENT_NODE,
    nodeName: '#document',
    documentElement: null as unknown as FigmaNode,
  }
  const root = wrapNode(rootNode, doc as unknown as FigmaNode)
  doc.documentElement = root
  doc._children = [root]
  return doc
}

function getAttrs(wrapped: FigmaNode): FigmaAttr[] {
  if (wrapped._attrs) return wrapped._attrs
  
  const node = wrapped._figmaNode
  const attrs: FigmaAttr[] = []
  
  for (const attrName of QUERYABLE_ATTRS) {
    if (attrName in node) {
      const value = (node as unknown as Record<string, unknown>)[attrName]
      // Skip figma.mixed symbol and undefined/null
      if (value === undefined || value === null || typeof value === 'symbol') {
        continue
      }
      attrs.push({
        nodeType: NODE_TYPES.ATTRIBUTE_NODE,
        nodeName: attrName,
        name: attrName,
        localName: attrName,
        namespaceURI: null,
        prefix: null,
        value: String(value),
        ownerElement: wrapped,
      })
    }
  }
  
  wrapped._attrs = attrs
  return attrs
}

function getChildren(wrapped: FigmaNode): FigmaNode[] {
  if (wrapped._children) return wrapped._children
  
  const node = wrapped._figmaNode
  if (!('children' in node) || !node.children) {
    wrapped._children = []
    return []
  }
  
  wrapped._children = node.children.map(child => wrapNode(child, wrapped))
  return wrapped._children
}

function isDocument(node: unknown): node is FigmaDocument {
  return (node as FigmaDocument)?.nodeType === NODE_TYPES.DOCUMENT_NODE
}

const figmaDomFacade = {
  getAllAttributes(node: FigmaNode | FigmaDocument): FigmaAttr[] {
    if (isDocument(node)) return []
    return getAttrs(node)
  },

  getAttribute(node: FigmaNode | FigmaDocument, attributeName: string): string | null {
    if (isDocument(node)) return null
    const figmaNode = node._figmaNode
    if (attributeName in figmaNode) {
      const value = (figmaNode as unknown as Record<string, unknown>)[attributeName]
      // Skip figma.mixed symbol and undefined/null
      if (value === undefined || value === null || typeof value === 'symbol') {
        return null
      }
      return String(value)
    }
    return null
  },

  getChildNodes(node: FigmaNode | FigmaDocument): FigmaNode[] {
    if (isDocument(node)) return node._children || []
    return getChildren(node)
  },

  getData(node: FigmaAttr): string {
    return node.value
  },

  getFirstChild(node: FigmaNode | FigmaDocument): FigmaNode | null {
    if (isDocument(node)) return node.documentElement
    const children = getChildren(node)
    return children[0] || null
  },

  getLastChild(node: FigmaNode | FigmaDocument): FigmaNode | null {
    if (isDocument(node)) return node.documentElement
    const children = getChildren(node)
    return children[children.length - 1] || null
  },

  getNextSibling(node: FigmaNode | FigmaDocument): FigmaNode | null {
    if (isDocument(node)) return null
    const parent = node._parent
    if (!parent) return null
    
    const siblings = getChildren(parent)
    const idx = siblings.indexOf(node)
    return siblings[idx + 1] || null
  },

  getParentNode(node: FigmaNode | FigmaDocument): FigmaNode | FigmaDocument | null {
    if (isDocument(node)) return null
    return node._parent || null
  },

  getPreviousSibling(node: FigmaNode | FigmaDocument): FigmaNode | null {
    if (isDocument(node)) return null
    const parent = node._parent
    if (!parent) return null
    
    const siblings = getChildren(parent)
    const idx = siblings.indexOf(node)
    return idx > 0 ? siblings[idx - 1] : null
  },
}

interface QueryOptions {
  limit?: number
}

export function queryNodes(
  selector: string,
  root: BaseNode | BaseNode[],
  options: QueryOptions = {}
): SceneNode[] {
  const { limit = 1000 } = options
  const roots = Array.isArray(root) ? root : [root]
  const results: SceneNode[] = []

  console.log('[xpath] Query:', selector)

  try {
    for (const rootNode of roots) {
      const doc = createDocument(rootNode as PageNode)
      
      console.log('[xpath] Evaluating on:', rootNode.name)
      
      const nodes = evaluateXPathToNodes(
        selector,
        doc,
        figmaDomFacade
      )

      console.log('[xpath] Found:', nodes.length)

      for (const node of nodes) {
        if (results.length >= limit) break
        const figmaNode = (node as FigmaNode)._figmaNode
        if (figmaNode && 'type' in figmaNode && figmaNode.type !== 'PAGE') {
          results.push(figmaNode as SceneNode)
        }
      }
    }
  } catch (err) {
    console.error('[xpath] Error:', err)
    throw err
  }

  console.log('[xpath] Total results:', results.length)
  return results
}

export function matchNode(
  selector: string,
  node: SceneNode
): boolean {
  try {
    const wrapped = wrapNode(node)
    return evaluateXPathToBoolean(
      `self::*[${selector}]`,
      wrapped,
      figmaDomFacade
    )
  } catch {
    return false
  }
}
