import { defineCommand } from 'citty'
import * as ts from 'typescript'

import { sendCommand, handleError } from '../../client.ts'

import type { FigmaNode, FormatOptions } from '../../types.ts'

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

// These types need SVG export
const SVG_TYPES = new Set(['VECTOR', 'STAR', 'POLYGON', 'LINE'])

// Iconify naming pattern: prefix:icon-name (e.g., lucide:save, mdi:home)
const ICONIFY_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/i

function findIconColor(node: FigmaNode): string | null {
  // Check fill first
  if (
    node.fills?.[0]?.type === 'SOLID' &&
    node.fills[0].color &&
    node.fills[0].color !== '#FFFFFF'
  ) {
    return node.fills[0].color
  }
  // Check stroke (many icons use stroke)
  if (node.strokes?.[0]?.type === 'SOLID' && node.strokes[0].color) {
    return node.strokes[0].color
  }
  // Check children recursively
  if (node.children) {
    for (const child of node.children) {
      const color = findIconColor(child)
      if (color) return color
    }
  }
  return null
}

async function enrichWithSvgData(node: FigmaNode): Promise<void> {
  // Skip entirely for Iconify icons (we use the name directly)
  if (node.name && ICONIFY_PATTERN.test(node.name)) {
    return
  }

  // Export SVG for vector types
  if (SVG_TYPES.has(node.type)) {
    try {
      const result = await sendCommand<{ svg: string }>('export-node-svg', { id: node.id })
      if (result?.svg) {
        node.svgData = result.svg
      }
    } catch {
      // Ignore errors, will render as empty
    }
  }
  if (node.children) {
    await Promise.all(node.children.map(enrichWithSvgData))
  }
}

function createJsxAttribute(name: string, value: ts.Expression): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(
    ts.factory.createIdentifier(name),
    ts.isStringLiteral(value) ? value : ts.factory.createJsxExpression(undefined, value)
  )
}

function numLit(n: number): ts.NumericLiteral {
  return ts.factory.createNumericLiteral(Math.round(n))
}

function strLit(s: string): ts.StringLiteral {
  return ts.factory.createStringLiteral(s)
}

function nodeToJsx(node: FigmaNode): ts.JsxChild | null {
  // Check for Iconify pattern in name (e.g., lucide:save, mdi:home)
  // Icons can be VECTOR nodes or FRAME wrappers containing vectors
  if (node.name && ICONIFY_PATTERN.test(node.name)) {
    const attrs: ts.JsxAttribute[] = []
    attrs.push(createJsxAttribute('name', strLit(node.name)))
    if (node.width) attrs.push(createJsxAttribute('size', numLit(node.width)))
    // Get fill color - check children for stroke color (SVG icons use stroke)
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

  // SVG types (Vector, Star, Polygon, Line)
  if (SVG_TYPES.has(node.type) && node.svgData) {
    const attrs: ts.JsxAttribute[] = []
    attrs.push(createJsxAttribute('src', strLit(node.svgData)))
    if (node.width) attrs.push(createJsxAttribute('w', numLit(node.width)))
    if (node.height) attrs.push(createJsxAttribute('h', numLit(node.height)))

    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier('SVG'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  // Text node
  if (node.type === 'TEXT' && node.characters) {
    const attrs: ts.JsxAttribute[] = []

    if (node.fontSize && node.fontSize !== 14) {
      attrs.push(createJsxAttribute('size', numLit(node.fontSize)))
    }
    if (node.fontWeight && node.fontWeight !== 400) {
      attrs.push(createJsxAttribute('weight', numLit(node.fontWeight)))
    }
    if (node.fills?.[0]?.color && node.fills[0].color !== '#000000') {
      attrs.push(createJsxAttribute('color', strLit(node.fills[0].color)))
    }

    return ts.factory.createJsxElement(
      ts.factory.createJsxOpeningElement(
        ts.factory.createIdentifier('Text'),
        undefined,
        ts.factory.createJsxAttributes(attrs)
      ),
      [ts.factory.createJsxText(node.characters, false)],
      ts.factory.createJsxClosingElement(ts.factory.createIdentifier('Text'))
    )
  }

  const tagName = TYPE_MAP[node.type]
  if (!tagName) return null

  const attrs: ts.JsxAttribute[] = []

  // Name (if meaningful)
  if (node.name && !node.name.startsWith('Frame') && !node.name.startsWith('Rectangle')) {
    attrs.push(createJsxAttribute('name', strLit(node.name)))
  }

  // Size
  if (node.width) attrs.push(createJsxAttribute('w', numLit(node.width)))
  if (node.height) attrs.push(createJsxAttribute('h', numLit(node.height)))

  // Fill
  if (node.fills?.[0]?.type === 'SOLID' && node.fills[0].color) {
    attrs.push(createJsxAttribute('bg', strLit(node.fills[0].color)))
  }

  // Stroke
  if (node.strokes?.[0]?.type === 'SOLID' && node.strokes[0].color) {
    attrs.push(createJsxAttribute('stroke', strLit(node.strokes[0].color)))
    if (node.strokeWeight && node.strokeWeight !== 1) {
      attrs.push(createJsxAttribute('strokeWidth', numLit(node.strokeWeight)))
    }
  }

  // Corner radius
  if (node.cornerRadius) {
    attrs.push(createJsxAttribute('rounded', numLit(node.cornerRadius)))
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity !== 1) {
    attrs.push(
      createJsxAttribute('opacity', ts.factory.createNumericLiteral(node.opacity.toFixed(2)))
    )
  }

  // Layout
  if (node.layoutMode === 'HORIZONTAL') {
    attrs.push(createJsxAttribute('flex', strLit('row')))
  } else if (node.layoutMode === 'VERTICAL') {
    attrs.push(createJsxAttribute('flex', strLit('col')))
  }

  // Gap
  if (node.itemSpacing) {
    attrs.push(createJsxAttribute('gap', numLit(node.itemSpacing)))
  }

  // Padding
  if (node.padding) {
    const { top, right, bottom, left } = node.padding
    if (top === right && right === bottom && bottom === left && top > 0) {
      attrs.push(createJsxAttribute('p', numLit(top)))
    } else {
      if (top === bottom && left === right && top !== left) {
        if (top > 0) attrs.push(createJsxAttribute('py', numLit(top)))
        if (left > 0) attrs.push(createJsxAttribute('px', numLit(left)))
      } else {
        if (top > 0) attrs.push(createJsxAttribute('pt', numLit(top)))
        if (right > 0) attrs.push(createJsxAttribute('pr', numLit(right)))
        if (bottom > 0) attrs.push(createJsxAttribute('pb', numLit(bottom)))
        if (left > 0) attrs.push(createJsxAttribute('pl', numLit(left)))
      }
    }
  }

  // Children
  const children: ts.JsxChild[] = []
  if (node.children) {
    for (const child of node.children) {
      const childJsx = nodeToJsx(child)
      if (childJsx) children.push(childJsx)
    }
  }

  if (children.length === 0) {
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier(tagName),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
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

function collectUsedComponents(node: FigmaNode, used: Set<string> = new Set()): Set<string> {
  // Check for Iconify pattern first (can be on any node type)
  if (node.name && ICONIFY_PATTERN.test(node.name)) {
    used.add('Icon')
    return used // Don't process children for icons
  }

  if (SVG_TYPES.has(node.type)) {
    used.add('SVG')
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

function generateCode(node: FigmaNode, componentName: string): string {
  const jsx = nodeToJsx(node)
  if (!jsx) return ''

  // Collect used components for import
  const usedComponents = collectUsedComponents(node)

  // Create: export default function ComponentName() { return <...> }
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

  // Create import statement with only used components
  const importSpecifiers = Array.from(usedComponents)
    .sort()
    .map((name) =>
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
    )

  const importDecl = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(importSpecifiers)
    ),
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

async function formatCode(code: string, options: FormatOptions = {}): Promise<string> {
  try {
    const oxfmt = await import('oxfmt')
    const result = await oxfmt.format('component.tsx', code, {
      semi: options.semi ?? false,
      singleQuote: options.singleQuote ?? true,
      tabWidth: options.tabWidth ?? 2,
      useTabs: options.useTabs ?? false,
      trailingComma: options.trailingComma ?? 'es5'
    })
    return result.code
  } catch {
    return code
  }
}

export default defineCommand({
  meta: { description: 'Export node as JSX component' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    name: { type: 'string', description: 'Component name (default: derived from node name)' },
    pretty: { type: 'boolean', description: 'Format output' },
    semi: { type: 'boolean', description: 'Add semicolons (default: false)' },
    'single-quote': { type: 'boolean', description: 'Use single quotes (default: true)' },
    'tab-width': { type: 'string', description: 'Spaces per indent (default: 2)' },
    tabs: { type: 'boolean', description: 'Use tabs instead of spaces' },
    'trailing-comma': {
      type: 'string',
      description: 'Trailing commas: none, es5, all (default: es5)'
    }
  },
  async run({ args }) {
    try {
      const node = await sendCommand<FigmaNode>('get-node-tree', {
        id: args.id
      })

      if (!node) {
        console.error('Node not found')
        process.exit(1)
      }

      // Enrich vector nodes with SVG data
      await enrichWithSvgData(node)

      // Reserved names that conflict with imports
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

      // Derive component name from node name
      let componentName =
        args.name || node.name.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '_$&') || 'Component'

      // Avoid conflicts with imported component names
      if (RESERVED.has(componentName)) {
        componentName = `${componentName}Component`
      }

      let code = generateCode(node, componentName)

      if (args.pretty) {
        code = await formatCode(code, {
          semi: args.semi,
          singleQuote: args['single-quote'] !== false,
          tabWidth: args['tab-width'] ? Number(args['tab-width']) : undefined,
          useTabs: args.tabs,
          trailingComma: args['trailing-comma'] as FormatOptions['trailingComma']
        })
      }

      console.log(code)
    } catch (e) {
      handleError(e)
    }
  }
})
