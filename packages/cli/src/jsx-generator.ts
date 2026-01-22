import * as ts from 'typescript'

import { sendCommand } from './client.ts'
import { installHint } from './format.ts'

import type { FigmaNode, FormatOptions } from './types.ts'

const TYPE_MAP: Record<string, string> = {
  FRAME: 'Frame',
  RECTANGLE: 'Rectangle',
  ELLIPSE: 'Ellipse',
  TEXT: 'Text',
  COMPONENT: 'Frame',
  COMPONENT_SET: 'Frame',
  INSTANCE: 'Frame',
  GROUP: 'Group',
  SECTION: 'Section'
}

const SVG_TYPES = new Set(['VECTOR', 'STAR', 'POLYGON', 'LINE'])
const ICONIFY_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/i
const RESERVED = new Set([
  'Frame',
  'Text',
  'Rectangle',
  'Ellipse',
  'Line',
  'Image',
  'SVG',
  'Icon',
  'Group',
  'Section',
  'Component'
])

function findIconColor(node: FigmaNode): string | null {
  if (node.fills?.[0]?.type === 'SOLID' && node.fills[0].color) {
    return node.fills[0].color
  }
  if (node.strokes?.[0]?.type === 'SOLID' && node.strokes[0].color) {
    return node.strokes[0].color
  }
  if (node.children) {
    for (const child of node.children) {
      const color = findIconColor(child)
      if (color) return color
    }
  }
  return null
}

function collectSvgNodeIds(node: FigmaNode, ids: string[]): void {
  if (node.name && ICONIFY_PATTERN.test(node.name)) {
    return
  }
  if (SVG_TYPES.has(node.type)) {
    ids.push(node.id)
  }
  if (node.children) {
    for (const child of node.children) {
      collectSvgNodeIds(child, ids)
    }
  }
}

function applySvgData(node: FigmaNode, svgMap: Record<string, string>): void {
  if (node.id && svgMap[node.id]) {
    node.svgData = svgMap[node.id]
  }
  if (node.children) {
    for (const child of node.children) {
      applySvgData(child, svgMap)
    }
  }
}

export async function enrichWithSvgData(node: FigmaNode): Promise<void> {
  const ids: string[] = []
  collectSvgNodeIds(node, ids)

  if (ids.length === 0) return

  try {
    const svgMap = await sendCommand<Record<string, string>>('batch-export-svg', { ids })
    if (svgMap) {
      applySvgData(node, svgMap)
    }
  } catch {
    // Fallback to individual requests
    for (const id of ids) {
      try {
        const result = await sendCommand<{ svg: string }>('export-node-svg', { id })
        if (result?.svg) {
          applySvgData(node, { [id]: result.svg })
        }
      } catch {
        // Ignore
      }
    }
  }
}

function createJsxAttribute(name: string, value: ts.Expression): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(
    ts.factory.createIdentifier(name),
    ts.isStringLiteral(value) ? value : ts.factory.createJsxExpression(undefined, value)
  )
}

function numLit(n: number): ts.Expression {
  const rounded = Math.round(n)
  if (rounded < 0) {
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      ts.factory.createNumericLiteral(Math.abs(rounded))
    )
  }
  return ts.factory.createNumericLiteral(rounded)
}

function strLit(s: string): ts.StringLiteral {
  return ts.factory.createStringLiteral(s)
}

function svgToJsx(svgString: string): ts.JsxElement | ts.JsxSelfClosingElement | null {
  // Parse SVG string and convert to JSX AST
  // Simple regex-based parser for common SVG elements
  const svgMatch = svgString.match(/<svg([^>]*)>([\s\S]*)<\/svg>/i)
  if (!svgMatch) return null

  const [, attrsStr, innerContent] = svgMatch

  // Parse attributes
  const attrs: ts.JsxAttribute[] = []
  const attrRegex = /(\w+(?:-\w+)*)="([^"]*)"/g
  let match
  while ((match = attrRegex.exec(attrsStr || '')) !== null) {
    const [, name, value] = match
    // Convert kebab-case to camelCase for React
    const jsxName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    // Skip xmlns
    if (jsxName === 'xmlns') continue
    attrs.push(createJsxAttribute(jsxName, strLit(value)))
  }

  // Parse child elements (path, rect, circle, etc.)
  const children: ts.JsxChild[] = []
  const elementRegex = /<(\w+)([^/>]*)(\/?)>/g
  let elemMatch
  while ((elemMatch = elementRegex.exec(innerContent || '')) !== null) {
    const [, tagName, elemAttrs, selfClose] = elemMatch
    const childAttrs: ts.JsxAttribute[] = []

    const childAttrRegex = /(\w+(?:-\w+)*)="([^"]*)"/g
    let childAttrMatch
    while ((childAttrMatch = childAttrRegex.exec(elemAttrs || '')) !== null) {
      const [, attrName, attrValue] = childAttrMatch
      // Convert kebab-case to camelCase
      const jsxAttrName = attrName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      childAttrs.push(createJsxAttribute(jsxAttrName, strLit(attrValue)))
    }

    children.push(
      ts.factory.createJsxSelfClosingElement(
        ts.factory.createIdentifier(tagName),
        undefined,
        ts.factory.createJsxAttributes(childAttrs)
      )
    )
  }

  if (children.length === 0) {
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier('svg'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  return ts.factory.createJsxElement(
    ts.factory.createJsxOpeningElement(
      ts.factory.createIdentifier('svg'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    ),
    children,
    ts.factory.createJsxClosingElement(ts.factory.createIdentifier('svg'))
  )
}

export interface JsxContext {
  textPropMap?: Map<string, string> // textPropertyRef → propName
  semanticHtml?: boolean // Convert to semantic HTML elements
  componentSetName?: string // Parent ComponentSet name for semantic detection
}

type SemanticElement = {
  tag: string
  type?: string // input type attribute
  selfClosing?: boolean
}

function getSemanticElement(name: string): SemanticElement | null {
  const lower = name.toLowerCase()

  // Input patterns
  if (
    lower.startsWith('input/') ||
    lower.startsWith('textfield/') ||
    lower.startsWith('textinput') ||
    lower === 'input' ||
    lower === 'textfield' ||
    lower === 'text-field' ||
    lower === 'text-input'
  ) {
    return { tag: 'input', type: 'text', selfClosing: true }
  }

  // Textarea patterns
  if (
    lower.startsWith('textarea/') ||
    lower === 'textarea' ||
    lower === 'text-area'
  ) {
    return { tag: 'textarea' }
  }

  // Select/Dropdown patterns
  if (
    lower.startsWith('select/') ||
    lower.startsWith('dropdown/') ||
    lower === 'select' ||
    lower === 'dropdown'
  ) {
    return { tag: 'select' }
  }

  // Checkbox patterns
  if (lower.startsWith('checkbox/') || lower === 'checkbox') {
    return { tag: 'input', type: 'checkbox', selfClosing: true }
  }

  // Radio patterns
  if (lower.startsWith('radio/') || lower === 'radio') {
    return { tag: 'input', type: 'radio', selfClosing: true }
  }

  // Button patterns
  if (lower.startsWith('button/') || lower === 'button') {
    return { tag: 'button' }
  }

  return null
}

export function nodeToJsx(node: FigmaNode, ctx: JsxContext = {}): ts.JsxChild | null {
  // Skip hidden nodes
  if (node.visible === false) return null

  // Check for matched icon first (from whaticon), then explicit iconify name
  const iconName = node.matchedIcon || (node.name && ICONIFY_PATTERN.test(node.name) ? node.name : null)
  if (iconName) {
    const attrs: ts.JsxAttribute[] = []
    attrs.push(createJsxAttribute('name', strLit(iconName)))
    if (node.width) attrs.push(createJsxAttribute('size', numLit(node.width)))
    const color = findIconColor(node)
    if (color) {
      attrs.push(createJsxAttribute('color', strLit(color)))
    }
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier('Icon'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  if (SVG_TYPES.has(node.type) && node.svgData) {
    const jsx = svgToJsx(node.svgData)
    if (jsx) return jsx
    // Fallback to SVG component if parsing fails
    const attrs: ts.JsxAttribute[] = []
    attrs.push(createJsxAttribute('src', strLit(node.svgData.replace(/\n/g, ' '))))
    if (node.width) attrs.push(createJsxAttribute('w', numLit(node.width)))
    if (node.height) attrs.push(createJsxAttribute('h', numLit(node.height)))
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier('SVG'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  if (node.type === 'TEXT' && node.characters) {
    const attrs: ts.JsxAttribute[] = []
    if (node.fontFamily) {
      attrs.push(createJsxAttribute('font', strLit(node.fontFamily)))
    }
    if (node.fontSize && node.fontSize !== 14) {
      attrs.push(createJsxAttribute('size', numLit(node.fontSize)))
    }
    if (node.fontWeight && node.fontWeight !== 400) {
      attrs.push(createJsxAttribute('weight', numLit(node.fontWeight)))
    }
    if (node.fills?.[0]?.color && node.fills[0].color !== '#000000') {
      attrs.push(createJsxAttribute('color', strLit(node.fills[0].color)))
    }
    // textAutoResize: WIDTH_AND_HEIGHT = no wrap (default), HEIGHT = wrap
    if (node.textAutoResize === 'HEIGHT') {
      attrs.push(createJsxAttribute('wrap', ts.factory.createTrue()))
    }

    // Check if text is bound to a component property
    const propName = node.textPropertyRef && ctx.textPropMap?.get(node.textPropertyRef)
    const textContent: ts.JsxChild = propName
      ? ts.factory.createJsxExpression(undefined, ts.factory.createIdentifier(propName))
      : ts.factory.createJsxText(node.characters, false)

    return ts.factory.createJsxElement(
      ts.factory.createJsxOpeningElement(
        ts.factory.createIdentifier('Text'),
        undefined,
        ts.factory.createJsxAttributes(attrs)
      ),
      [textContent],
      ts.factory.createJsxClosingElement(ts.factory.createIdentifier('Text'))
    )
  }

  const baseTagName = TYPE_MAP[node.type]
  if (!baseTagName) return null

  // Check for semantic HTML element (use componentSetName if available)
  const nameForSemantic = ctx.componentSetName || node.name
  const semantic = ctx.semanticHtml && nameForSemantic ? getSemanticElement(nameForSemantic) : null
  const tagName = semantic?.tag || baseTagName
  const isSemanticElement = !!semantic

  const attrs: ts.JsxAttribute[] = []

  // Add type attribute for inputs
  if (semantic?.type) {
    attrs.push(createJsxAttribute('type', strLit(semantic.type)))
  }

  if (node.name && !node.name.match(/^(Frame|Rectangle)\s*\d*$/)) {
    // Don't add name for semantic elements (it's redundant)
    if (!isSemanticElement) {
      attrs.push(createJsxAttribute('name', strLit(node.name)))
    }
  }
  // Width: skip if HUG, use "fill" if FILL, otherwise fixed
  if (node.layoutSizingHorizontal === 'FILL') {
    attrs.push(createJsxAttribute('w', strLit('fill')))
  } else if (node.layoutSizingHorizontal !== 'HUG' && node.width) {
    attrs.push(createJsxAttribute('w', numLit(node.width)))
  }

  // Height: skip if HUG, use "fill" if FILL, otherwise fixed
  if (node.layoutSizingVertical === 'FILL') {
    attrs.push(createJsxAttribute('h', strLit('fill')))
  } else if (node.layoutSizingVertical !== 'HUG' && node.height) {
    attrs.push(createJsxAttribute('h', numLit(node.height)))
  }
  if (node.fills?.[0]?.type === 'SOLID' && node.fills[0].color) {
    attrs.push(createJsxAttribute('bg', strLit(node.fills[0].color)))
  }
  if (node.strokes?.[0]?.type === 'SOLID' && node.strokes[0].color) {
    attrs.push(createJsxAttribute('stroke', strLit(node.strokes[0].color)))
    if (node.strokeWeight && node.strokeWeight !== 1) {
      attrs.push(createJsxAttribute('strokeWidth', numLit(node.strokeWeight)))
    }
  }
  if (node.cornerRadius) {
    attrs.push(createJsxAttribute('rounded', numLit(node.cornerRadius)))
  }
  if (node.opacity !== undefined && node.opacity !== 1) {
    attrs.push(
      createJsxAttribute('opacity', ts.factory.createNumericLiteral(node.opacity.toFixed(2)))
    )
  }
  if (node.layoutMode === 'HORIZONTAL') {
    attrs.push(createJsxAttribute('flex', strLit('row')))
  } else if (node.layoutMode === 'VERTICAL') {
    attrs.push(createJsxAttribute('flex', strLit('col')))
  }
  if (node.itemSpacing) {
    attrs.push(createJsxAttribute('gap', numLit(node.itemSpacing)))
  }
  // Alignment
  if (node.primaryAxisAlignItems) {
    const justifyMap: Record<string, string> = {
      CENTER: 'center',
      MAX: 'end',
      SPACE_BETWEEN: 'between'
    }
    const justify = justifyMap[node.primaryAxisAlignItems]
    if (justify) attrs.push(createJsxAttribute('justify', strLit(justify)))
  }
  if (node.counterAxisAlignItems) {
    const itemsMap: Record<string, string> = {
      CENTER: 'center',
      MAX: 'end',
      BASELINE: 'baseline'
    }
    const items = itemsMap[node.counterAxisAlignItems]
    if (items) attrs.push(createJsxAttribute('items', strLit(items)))
  }
  if (node.padding) {
    const { top, right, bottom, left } = node.padding
    if (top === right && right === bottom && bottom === left && top > 0) {
      attrs.push(createJsxAttribute('p', numLit(top)))
    } else if (top === bottom && left === right && top !== left) {
      if (top > 0) attrs.push(createJsxAttribute('py', numLit(top)))
      if (left > 0) attrs.push(createJsxAttribute('px', numLit(left)))
    } else {
      if (top > 0) attrs.push(createJsxAttribute('pt', numLit(top)))
      if (right > 0) attrs.push(createJsxAttribute('pr', numLit(right)))
      if (bottom > 0) attrs.push(createJsxAttribute('pb', numLit(bottom)))
      if (left > 0) attrs.push(createJsxAttribute('pl', numLit(left)))
    }
  }

  const children: ts.JsxChild[] = []
  if (node.children) {
    for (const child of node.children) {
      const childJsx = nodeToJsx(child, ctx)
      if (childJsx) children.push(childJsx)
    }
  }

  // Semantic elements that are self-closing (input) or should ignore children
  if (semantic?.selfClosing) {
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier(tagName),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  if (children.length === 0) {
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier(tagName),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  // For semantic elements like button, extract text content
  if (isSemanticElement && tagName === 'button') {
    const textChild = findTextChild(node)
    if (textChild) {
      return ts.factory.createJsxElement(
        ts.factory.createJsxOpeningElement(
          ts.factory.createIdentifier(tagName),
          undefined,
          ts.factory.createJsxAttributes(attrs)
        ),
        [ts.factory.createJsxText(textChild, false)],
        ts.factory.createJsxClosingElement(ts.factory.createIdentifier(tagName))
      )
    }
  }

  return ts.factory.createJsxElement(
    ts.factory.createJsxOpeningElement(
      ts.factory.createIdentifier(tagName),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    ),
    children,
    ts.factory.createJsxClosingElement(ts.factory.createIdentifier(tagName))
  )
}

function findTextChild(node: FigmaNode): string | null {
  if (node.type === 'TEXT' && node.characters) {
    return node.characters
  }
  if (node.children) {
    for (const child of node.children) {
      const text = findTextChild(child)
      if (text) return text
    }
  }
  return null
}

export function collectUsedComponents(node: FigmaNode, used: Set<string> = new Set()): Set<string> {
  const iconName = node.matchedIcon || (node.name && ICONIFY_PATTERN.test(node.name) ? node.name : null)
  if (iconName) {
    used.add('Icon')
    return used
  }
  if (SVG_TYPES.has(node.type)) {
    // Inline <svg> doesn't need import, but fallback <SVG> does
    // Check if svgData can be parsed to inline svg
    if (!node.svgData || !svgToJsx(node.svgData)) {
      used.add('SVG')
    }
  } else {
    const tagName = node.type === 'TEXT' ? 'Text' : TYPE_MAP[node.type]
    if (tagName) used.add(tagName)
  }
  if (node.children) {
    for (const child of node.children) {
      collectUsedComponents(child, used)
    }
  }
  return used
}

export function generateCode(
  node: FigmaNode,
  componentName: string,
  ctx: JsxContext = {}
): string {
  const jsx = nodeToJsx(node, ctx)
  if (!jsx) return ''

  const usedComponents = collectUsedComponents(node)

  const returnStmt = ts.factory.createReturnStatement(jsx as ts.Expression)
  const funcBody = ts.factory.createBlock([returnStmt], true)
  const func = ts.factory.createFunctionDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
      ts.factory.createModifier(ts.SyntaxKind.DefaultKeyword)
    ],
    undefined,
    ts.factory.createIdentifier(componentName),
    undefined,
    [],
    undefined,
    funcBody
  )

  const importSpecifiers = Array.from(usedComponents)
    .sort()
    .map((name) => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name)))

  const importDecl = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(importSpecifiers)),
    ts.factory.createStringLiteral('figma-use/render')
  )

  const sourceFile = ts.factory.createSourceFile(
    [importDecl, func],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  )

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    omitTrailingSemicolon: false
  })

  return printer.printFile(sourceFile)
}

export function toComponentName(name: string): string {
  let result = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[0-9]/, '_$&') || 'Component'
  if (RESERVED.has(result)) {
    result = `${result}Component`
  }
  return result
}

export async function formatCode(code: string, options: FormatOptions = {}): Promise<string> {
  try {
    const oxfmt = await import('oxfmt')
    const result = await oxfmt.format('component.tsx', code, {
      semi: options.semi ?? false,
      singleQuote: options.singleQuote ?? true,
      tabWidth: options.tabWidth ?? 2,
      useTabs: options.useTabs ?? false,
      trailingComma: options.trailingComma ?? 'es5',
      printWidth: options.printWidth ?? 100
    })
    let formatted = result.code
    // Add blank lines for better readability
    formatted = formatted.replace(/^(import .+\n)(?!import)/m, '$1\n')
    formatted = formatted.replace(/^(export default .+)\n(?!\n)/m, '$1\n\n')
    formatted = formatted.replace(/^(}\n)(export const)/gm, '$1\n$2')
    return formatted
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`oxfmt is required. Install it:\n\n  ${installHint('oxfmt')}\n`)
      process.exit(1)
    }
    throw e
  }
}
