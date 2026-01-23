import { defineCommand } from 'citty'
import { createTwoFilesPatch } from 'diff'
import { bold, green, red, cyan } from 'agentfmt'
import * as ts from 'typescript'

import { sendCommand, handleError } from '../../client.ts'
import { installHint } from '../../format.ts'

import type { FigmaNode, FormatOptions } from '../../types.ts'

// Import the JSX generation logic from export/jsx.ts
// We inline a simplified version here to avoid circular deps

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

const ICONIFY_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/i

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

function nodeToJsxAst(node: FigmaNode): ts.JsxChild | null {
  if (node.name && ICONIFY_PATTERN.test(node.name)) {
    const attrs: ts.JsxAttribute[] = [createJsxAttribute('name', strLit(node.name))]
    if (node.width) attrs.push(createJsxAttribute('size', numLit(node.width)))
    return ts.factory.createJsxSelfClosingElement(
      ts.factory.createIdentifier('Icon'),
      undefined,
      ts.factory.createJsxAttributes(attrs)
    )
  }

  if (node.type === 'TEXT' && node.characters) {
    const attrs: ts.JsxAttribute[] = []
    if (node.fontSize && node.fontSize !== 14)
      attrs.push(createJsxAttribute('size', numLit(node.fontSize)))
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
  if (node.name && !node.name.match(/^(Frame|Rectangle)\s*\d*$/)) {
    attrs.push(createJsxAttribute('name', strLit(node.name)))
  }
  if (node.width) attrs.push(createJsxAttribute('w', numLit(node.width)))
  if (node.height) attrs.push(createJsxAttribute('h', numLit(node.height)))
  if (node.fills?.[0]?.color) attrs.push(createJsxAttribute('bg', strLit(node.fills[0].color)))
  if (node.strokes?.[0]?.color)
    attrs.push(createJsxAttribute('stroke', strLit(node.strokes[0].color)))
  if (node.cornerRadius) attrs.push(createJsxAttribute('rounded', numLit(node.cornerRadius)))
  if (node.layoutMode === 'HORIZONTAL') attrs.push(createJsxAttribute('flex', strLit('row')))
  if (node.layoutMode === 'VERTICAL') attrs.push(createJsxAttribute('flex', strLit('col')))
  if (node.itemSpacing) attrs.push(createJsxAttribute('gap', numLit(node.itemSpacing)))
  if (node.padding) {
    const { top, right, bottom, left } = node.padding
    if (top === right && right === bottom && bottom === left && top > 0) {
      attrs.push(createJsxAttribute('p', numLit(top)))
    } else if (top === bottom && left === right) {
      if (top > 0) attrs.push(createJsxAttribute('py', numLit(top)))
      if (left > 0) attrs.push(createJsxAttribute('px', numLit(left)))
    }
  }

  const children: ts.JsxChild[] = []
  if (node.children) {
    for (const child of node.children) {
      const childJsx = nodeToJsxAst(child)
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
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`oxfmt is required for diff jsx. Install it:\n\n  ${installHint('oxfmt')}\n`)
      process.exit(1)
    }
    throw e
  }
}

async function nodeToJsx(id: string, formatOptions: FormatOptions = {}): Promise<string> {
  const node = await sendCommand<FigmaNode>('get-node-tree', { id })
  if (!node) throw new Error('Node not found')

  const jsx = nodeToJsxAst(node)
  if (!jsx) return ''

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  const sourceFile = ts.createSourceFile(
    'temp.tsx',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  )
  const code = printer.printNode(ts.EmitHint.Unspecified, jsx, sourceFile)

  return formatCode(code, formatOptions)
}

export default defineCommand({
  meta: { description: 'Show JSX diff between two nodes' },
  args: {
    from: { type: 'positional', description: 'Source node ID', required: true },
    to: { type: 'positional', description: 'Target node ID', required: true },
    context: { type: 'string', description: 'Lines of context (default: 3)', default: '3' },
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
      const formatOptions: FormatOptions = {
        semi: args.semi,
        singleQuote: args['single-quote'] !== false,
        tabWidth: args['tab-width'] ? Number(args['tab-width']) : undefined,
        useTabs: args.tabs,
        trailingComma: args['trailing-comma'] as FormatOptions['trailingComma']
      }

      // Sequential to avoid CDP connection issues
      const fromJsx = await nodeToJsx(args.from, formatOptions)
      const toJsx = await nodeToJsx(args.to, formatOptions)

      if (fromJsx === toJsx) {
        console.log('No differences')
        return
      }

      const patch = createTwoFilesPatch(args.from, args.to, fromJsx, toJsx, 'source', 'target', {
        context: Number(args.context)
      })

      // Colorize output
      const lines = patch.split('\n')
      for (const line of lines) {
        if (line.startsWith('+++') || line.startsWith('---')) {
          console.log(bold(line))
        } else if (line.startsWith('+')) {
          console.log(green(line))
        } else if (line.startsWith('-')) {
          console.log(red(line))
        } else if (line.startsWith('@@')) {
          console.log(cyan(line))
        } else {
          console.log(line)
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
