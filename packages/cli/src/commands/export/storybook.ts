import { defineCommand } from 'citty'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as ts from 'typescript'

import { sendCommand, handleError } from '../../client.ts'
import { writeFontsCss } from '../../fonts.ts'
import { ok, fail } from '../../format.ts'
import { matchIconsInTree } from '../../icon-matcher.ts'
import {
  collectUsedComponents,
  enrichWithSvgData,
  formatCode,
  nodeToJsx,
  toComponentName
} from '../../jsx-generator.ts'

import type { FigmaNode, FormatOptions } from '../../types.ts'

interface FrameworkConfig {
  module: string
  storybookType: string
  fileExt: string
}

const FRAMEWORKS: Record<string, FrameworkConfig> = {
  react: {
    module: '@figma-use/react',
    storybookType: '@storybook/react',
    fileExt: '.stories.tsx'
  },
  vue: {
    module: '@figma-use/vue',
    storybookType: '@storybook/vue3',
    fileExt: '.stories.tsx'
  }
}

interface ComponentInfo {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET'
  componentSetId?: string
}

interface ComponentGroup {
  baseName: string
  components: ComponentInfo[]
}

interface ExportResult {
  name: string
  file: string
  variants: number
}

interface ExportError {
  name: string
  error: string
}

function sanitizeFilename(name: string): string {
  return name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9-_]/g, '')
}

function variantNameToIdentifier(name: string): string {
  return name
    .split(/[\s=\/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
}

function groupComponents(components: ComponentInfo[]): Map<string, ComponentGroup> {
  const groups = new Map<string, ComponentGroup>()
  const componentSets = new Map<string, string>()

  for (const comp of components) {
    if (comp.type === 'COMPONENT_SET') {
      componentSets.set(comp.id, comp.name)
    }
  }

  for (const comp of components) {
    if (comp.type === 'COMPONENT_SET') continue

    let groupKey: string
    let baseName: string

    if (comp.componentSetId) {
      groupKey = comp.componentSetId
      baseName = componentSets.get(comp.componentSetId) || comp.name.split(',')[0].split('=')[0]
    } else if (comp.name.includes('/')) {
      baseName = comp.name.split('/')[0]
      groupKey = `name:${baseName}`
    } else {
      baseName = comp.name
      groupKey = `id:${comp.id}`
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { baseName, components: [] })
    }
    groups.get(groupKey)!.components.push(comp)
  }

  return groups
}

function getVariantName(compName: string): string {
  if (compName.includes('/')) {
    return compName.split('/').slice(1).join('/')
  }
  if (compName.includes('=')) {
    return compName
      .split(', ')
      .map((pair) => pair.split('=')[1])
      .join('')
  }
  return 'Default'
}

function generateStorybookAST(
  title: string,
  variants: Array<{ name: string; jsx: ts.JsxChild }>,
  usedComponents: Set<string>,
  framework: FrameworkConfig
): ts.SourceFile {
  const statements: ts.Statement[] = []

  // import React from 'react'
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(false, ts.factory.createIdentifier('React'), undefined),
      ts.factory.createStringLiteral('react')
    )
  )

  // import type { Meta, StoryObj } from '@storybook/react'
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        true,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('Meta')),
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('StoryObj'))
        ])
      ),
      ts.factory.createStringLiteral(framework.storybookType)
    )
  )

  // import { Frame, Text, ... } from '@figma-use/react'
  const renderImports = Array.from(usedComponents).sort()
  if (renderImports.length > 0) {
    statements.push(
      ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports(
            renderImports.map((name) =>
              ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
            )
          )
        ),
        ts.factory.createStringLiteral(framework.module)
      )
    )
  }

  // const meta: Meta = { title }
  statements.push(
    ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            'meta',
            undefined,
            ts.factory.createTypeReferenceNode('Meta'),
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment('title', ts.factory.createStringLiteral(title))
            ])
          )
        ],
        ts.NodeFlags.Const
      )
    )
  )

  // export default meta
  statements.push(ts.factory.createExportDefault(ts.factory.createIdentifier('meta')))

  // type Story = StoryObj
  statements.push(
    ts.factory.createTypeAliasDeclaration(
      undefined,
      'Story',
      undefined,
      ts.factory.createTypeReferenceNode('StoryObj')
    )
  )

  // export const VariantName: Story = { render: () => <...> }
  for (const variant of variants) {
    statements.push(
      ts.factory.createVariableStatement(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              variantNameToIdentifier(variant.name),
              undefined,
              ts.factory.createTypeReferenceNode('Story'),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  'render',
                  ts.factory.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    variant.jsx as ts.Expression
                  )
                )
              ])
            )
          ],
          ts.NodeFlags.Const
        )
      )
    )
  }

  return ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  )
}

interface ProcessOptions {
  matchIcons: boolean
  iconThreshold: number
  preferIcons?: string[]
  verbose: boolean
}

async function processComponent(
  comp: ComponentInfo,
  options: ProcessOptions
): Promise<{ jsx: ts.JsxChild; usedComponents: Set<string> } | null> {
  const node = await sendCommand<FigmaNode>('get-node-tree', { id: comp.id })
  if (!node) return null

  await enrichWithSvgData(node)

  if (options.matchIcons) {
    await matchIconsInTree(node, {
      threshold: options.iconThreshold,
      prefer: options.preferIcons,
      onMatch: options.verbose
        ? (n, match) => {
            console.error(`Matched: ${n.name} → ${match.name} (${(match.similarity * 100).toFixed(0)}%)`)
          }
        : undefined
    })
  }

  const jsx = nodeToJsx(node)
  if (!jsx) return null

  const usedComponents = new Set<string>()
  collectUsedComponents(node, usedComponents)

  return { jsx, usedComponents }
}

async function exportGroup(
  group: ComponentGroup,
  options: ProcessOptions,
  framework: FrameworkConfig,
  formatOptions: FormatOptions,
  outDir: string,
  printer: ts.Printer
): Promise<ExportResult | ExportError> {
  const { baseName, components: comps } = group

  try {
    const variants: Array<{ name: string; jsx: ts.JsxChild }> = []
    const usedComponents = new Set<string>()

    for (const comp of comps) {
      const result = await processComponent(comp, options)
      if (!result) continue

      for (const c of result.usedComponents) usedComponents.add(c)
      variants.push({ name: getVariantName(comp.name), jsx: result.jsx })
    }

    if (variants.length === 0) {
      return { name: baseName, error: 'No variants exported' }
    }

    const sourceFile = generateStorybookAST(baseName, variants, usedComponents, framework)
    let code = printer.printFile(sourceFile)
    code = await formatCode(code, formatOptions)

    const filePath = join(outDir, `${sanitizeFilename(baseName)}${framework.fileExt}`)
    writeFileSync(filePath, code)

    return { name: baseName, file: filePath, variants: variants.length }
  } catch (e) {
    return { name: baseName, error: (e as Error).message }
  }
}

function isError(result: ExportResult | ExportError): result is ExportError {
  return 'error' in result
}

export default defineCommand({
  meta: { description: 'Export components as Storybook stories' },
  args: {
    out: { type: 'string', description: 'Output directory', default: './stories' },
    page: { type: 'string', description: 'Page name (default: current page)' },
    'match-icons': { type: 'boolean', description: 'Match vectors to Iconify icons' },
    'icon-threshold': { type: 'string', description: 'Icon match threshold 0-1 (default: 0.9)' },
    'prefer-icons': { type: 'string', description: 'Preferred icon sets (comma-separated)' },
    verbose: { type: 'boolean', alias: 'v', description: 'Show matched icons' },
    framework: { type: 'string', description: 'Framework: react (default), vue' },
    'no-fonts': { type: 'boolean', description: 'Skip fonts.css generation' },
    semi: { type: 'boolean', description: 'Add semicolons' },
    'single-quote': { type: 'boolean', description: 'Use single quotes (default: true)' },
    'tab-width': { type: 'string', description: 'Spaces per indent (default: 2)' },
    tabs: { type: 'boolean', description: 'Use tabs instead of spaces' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const frameworkName = args.framework || 'react'
      const framework = FRAMEWORKS[frameworkName]
      if (!framework) {
        console.error(`Unknown framework: ${frameworkName}. Available: ${Object.keys(FRAMEWORKS).join(', ')}`)
        process.exit(1)
      }

      if (args.page) {
        await sendCommand('set-current-page', { name: args.page })
      }

      const components = await sendCommand<ComponentInfo[]>('get-all-components', { limit: 1000 })
      if (!components?.length) {
        console.log(args.json ? '[]' : 'No components found on this page')
        return
      }

      const outDir = args.out
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      const formatOptions: FormatOptions = {
        semi: args.semi,
        singleQuote: args['single-quote'] !== false,
        tabWidth: args['tab-width'] ? Number(args['tab-width']) : undefined,
        useTabs: args.tabs
      }

      const processOptions: ProcessOptions = {
        matchIcons: !!args['match-icons'],
        iconThreshold: args['icon-threshold'] ? parseFloat(args['icon-threshold']) : 0.9,
        preferIcons: args['prefer-icons']?.split(',').map((s) => s.trim()),
        verbose: !!args.verbose
      }

      const groups = groupComponents(components)
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
      const exportedFiles = new Set<string>()

      const allResults = await Promise.all(
        Array.from(groups.values()).map((group) =>
          exportGroup(group, processOptions, framework, formatOptions, outDir, printer)
        )
      )

      const results = allResults.filter((r): r is ExportResult => !isError(r) && !exportedFiles.has(r.file))
      const errors = allResults.filter(isError)

      // Generate fonts.css
      let fontsFile: string | null = null
      if (!args['no-fonts'] && results.length > 0) {
        fontsFile = await writeFontsCss(outDir)
      }

      if (args.json) {
        console.log(JSON.stringify({ exported: results, errors, fonts: fontsFile }, null, 2))
      } else {
        for (const r of results) {
          const variantInfo = r.variants > 1 ? ` (${r.variants} variants)` : ''
          console.log(ok(`${r.name}${variantInfo} → ${r.file}`))
        }
        if (fontsFile) {
          console.log(ok(`fonts → ${fontsFile}`))
        }
        for (const e of errors) {
          console.log(fail(`${e.name}: ${e.error}`))
        }
        console.log(
          `\nExported ${results.length} stories${fontsFile ? ' + fonts.css' : ''}${errors.length ? `, ${errors.length} errors` : ''}`
        )
      }
    } catch (e) {
      handleError(e)
    }
  }
})
