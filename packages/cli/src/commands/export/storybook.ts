import { defineCommand } from 'citty'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as ts from 'typescript'

import { sendCommand, handleError } from '../../client.ts'
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

interface ComponentInfo {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET'
  componentSetId?: string
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '')
}

function variantNameToIdentifier(name: string): string {
  // "Primary with Icon" -> "PrimaryWithIcon"
  // "Checked=true" -> "CheckedTrue"
  return name
    .split(/[\s=\/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
}

function generateStorybook(
  componentName: string,
  title: string,
  variants: Array<{ name: string; jsx: ts.JsxChild }>,
  usedComponents: Set<string>
): ts.SourceFile {
  const statements: ts.Statement[] = []

  // import type { Meta, StoryObj } from '@storybook/react'
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        true,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('Meta')),
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier('StoryObj')
          )
        ])
      ),
      ts.factory.createStringLiteral('@storybook/react')
    )
  )

  // import { Frame, Text, ... } from 'figma-use/render' — only used components
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
        ts.factory.createStringLiteral('figma-use/render')
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
            ts.factory.createIdentifier('meta'),
            undefined,
            ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Meta')),
            ts.factory.createObjectLiteralExpression(
              [
                ts.factory.createPropertyAssignment(
                  ts.factory.createIdentifier('title'),
                  ts.factory.createStringLiteral(title)
                )
              ],
              false
            )
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
      ts.factory.createIdentifier('Story'),
      undefined,
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('StoryObj'))
    )
  )

  // Generate each variant as a story
  for (const variant of variants) {
    const storyName = variantNameToIdentifier(variant.name)

    // export const VariantName: Story = { render: () => <...> }
    statements.push(
      ts.factory.createVariableStatement(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(storyName),
              undefined,
              ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Story')),
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createPropertyAssignment(
                    ts.factory.createIdentifier('render'),
                    ts.factory.createArrowFunction(
                      undefined,
                      undefined,
                      [],
                      undefined,
                      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                      variant.jsx as ts.Expression
                    )
                  )
                ],
                false
              )
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

export default defineCommand({
  meta: { description: 'Export components as Storybook stories' },
  args: {
    out: {
      type: 'string',
      description: 'Output directory (default: ./stories)',
      default: './stories'
    },
    page: { type: 'string', description: 'Page name (default: current page)' },
    'match-icons': { type: 'boolean', description: 'Match vector shapes to Iconify icons (requires whaticon)' },
    'icon-threshold': { type: 'string', description: 'Icon match threshold 0-1 (default: 0.9)' },
    'prefer-icons': { type: 'string', description: 'Preferred icon sets (comma-separated, e.g., lucide,tabler)' },
    verbose: { type: 'boolean', alias: 'v', description: 'Show matched icons' },
    semi: { type: 'boolean', description: 'Add semicolons (default: false)' },
    'single-quote': { type: 'boolean', description: 'Use single quotes (default: true)' },
    'tab-width': { type: 'string', description: 'Spaces per indent (default: 2)' },
    tabs: { type: 'boolean', description: 'Use tabs instead of spaces' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      if (args.page) {
        await sendCommand('set-current-page', { name: args.page })
      }

      const components = await sendCommand<ComponentInfo[]>('get-all-components', { limit: 1000 })

      if (!components || components.length === 0) {
        console.log(args.json ? '[]' : 'No components found on this page')
        return
      }

      const formatOptions: FormatOptions = {
        semi: args.semi,
        singleQuote: args['single-quote'] !== false,
        tabWidth: args['tab-width'] ? Number(args['tab-width']) : undefined,
        useTabs: args.tabs
      }

      const outDir = args.out
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      // Group components:
      // 1. By componentSetId if present (variants in a ComponentSet)
      // 2. By name prefix before "/" (e.g., "Button/Primary" → "Button")
      // 3. Otherwise, each component is its own group
      const groups = new Map<string, { baseName: string; components: ComponentInfo[] }>()
      const componentSets = new Map<string, string>() // id → name
      
      // First pass: collect ComponentSet names
      for (const comp of components) {
        if (comp.type === 'COMPONENT_SET') {
          componentSets.set(comp.id, comp.name)
        }
      }
      
      // Second pass: group components
      for (const comp of components) {
        // Skip ComponentSets themselves, we only want their children
        if (comp.type === 'COMPONENT_SET') continue
        
        let groupKey: string
        let baseName: string
        
        if (comp.componentSetId) {
          // Component is part of a ComponentSet - group by set id
          groupKey = comp.componentSetId
          baseName = componentSets.get(comp.componentSetId) || comp.name.split(',')[0].split('=')[0]
        } else if (comp.name.includes('/')) {
          // Slash hierarchy: "Button/Primary" → "Button"
          baseName = comp.name.split('/')[0]
          groupKey = `name:${baseName}`
        } else {
          // Standalone component
          baseName = comp.name
          groupKey = `id:${comp.id}`
        }
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, { baseName, components: [] })
        }
        groups.get(groupKey)!.components.push(comp)
      }

      const results: Array<{ name: string; file: string; variants: number }> = []
      const errors: Array<{ name: string; error: string }> = []
      const exportedFiles = new Set<string>()
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

      for (const [, group] of groups) {
        const { baseName, components: comps } = group
        try {
          const variants: Array<{ name: string; jsx: ts.JsxChild }> = []
          const usedComponents = new Set<string>()

          for (const comp of comps) {
            const node = await sendCommand<FigmaNode>('get-node-tree', { id: comp.id })
            if (!node) continue

            await enrichWithSvgData(node)

            if (args['match-icons']) {
              const threshold = args['icon-threshold'] ? parseFloat(args['icon-threshold']) : 0.9
              const prefer = args['prefer-icons']?.split(',').map((s) => s.trim())
              await matchIconsInTree(node, {
                threshold,
                prefer,
                onMatch: args.verbose
                  ? (n, match) => {
                      console.error(`Matched: ${n.name} → ${match.name} (${(match.similarity * 100).toFixed(0)}%)`)
                    }
                  : undefined
              })
            }

            const jsx = nodeToJsx(node)
            if (!jsx) continue

            // Collect used components from this node
            collectUsedComponents(node, usedComponents)

            // Variant name: part after / or after = or "Default"
            let variantName: string
            if (comp.name.includes('/')) {
              variantName = comp.name.split('/').slice(1).join('/')
            } else if (comp.name.includes('=')) {
              // "Checked=true" → "True", "Size=Large, State=Active" → "LargeActive"
              variantName = comp.name
                .split(', ')
                .map((pair) => pair.split('=')[1])
                .join('')
            } else {
              variantName = 'Default'
            }

            variants.push({ name: variantName, jsx })
          }

          if (variants.length === 0) continue

          const componentName = toComponentName(baseName)
          const sourceFile = generateStorybook(componentName, baseName, variants, usedComponents)
          let code = printer.printFile(sourceFile)
          code = await formatCode(code, formatOptions)

          const filePath = join(outDir, `${sanitizeFilename(baseName)}.stories.tsx`)
          if (exportedFiles.has(filePath)) {
            errors.push({ name: baseName, error: 'Duplicate component name, skipped' })
            continue
          }
          exportedFiles.add(filePath)
          writeFileSync(filePath, code)
          results.push({ name: baseName, file: filePath, variants: variants.length })
        } catch (e) {
          errors.push({ name: baseName, error: (e as Error).message })
        }
      }

      if (args.json) {
        console.log(JSON.stringify({ exported: results, errors }, null, 2))
      } else {
        for (const r of results) {
          const variantInfo = r.variants > 1 ? ` (${r.variants} variants)` : ''
          console.log(ok(`${r.name}${variantInfo} → ${r.file}`))
        }
        for (const e of errors) {
          console.log(fail(`${e.name}: ${e.error}`))
        }
        console.log(
          `\nExported ${results.length} stories${errors.length > 0 ? `, ${errors.length} errors` : ''}`
        )
      }
    } catch (e) {
      handleError(e)
    }
  }
})
