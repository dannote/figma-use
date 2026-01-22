import { defineCommand } from 'citty'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as ts from 'typescript'

import { closeCDP } from '../../cdp.ts'
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

interface ComponentPropertyDefinition {
  type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP'
  defaultValue: string
  variantOptions?: string[]
}

interface ComponentInfo {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET'
  componentSetId?: string
  componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>
}

interface PropInfo {
  name: string
  camelName: string
  type: 'boolean' | 'string' | 'text'
  options?: string[]
  defaultValue: string
}

interface ComponentGroup {
  baseName: string
  components: ComponentInfo[]
  isComponentSet: boolean
  props?: PropInfo[]
  componentSetId?: string
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

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toLowerCase())
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function parseProps(definitions: Record<string, ComponentPropertyDefinition>): PropInfo[] {
  const props: PropInfo[] = []

  for (const [name, def] of Object.entries(definitions)) {
    if (def.type === 'VARIANT') {
      const options = def.variantOptions || []
      const isBoolean =
        options.length === 2 &&
        options.every((o) => o.toLowerCase() === 'true' || o.toLowerCase() === 'false')

      // Auto-rename generic "Property N" to semantic names for booleans
      let camelName = toCamelCase(name.split('#')[0])
      if (isBoolean && /^property\d*$/i.test(camelName)) {
        camelName = 'checked'
      }

      props.push({
        name,
        camelName,
        type: isBoolean ? 'boolean' : 'string',
        options: isBoolean ? undefined : options,
        defaultValue: def.defaultValue
      })
    } else if (def.type === 'TEXT') {
      // TEXT properties become string props
      const baseName = name.split('#')[0]
      props.push({
        name,
        camelName: toCamelCase(baseName),
        type: 'text',
        defaultValue: def.defaultValue
      })
    }
  }

  return props
}

function parseVariantName(name: string): Record<string, string> {
  const result: Record<string, string> = {}
  const pairs = name.split(', ')
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key && value) {
      result[key.trim()] = value.trim()
    }
  }
  return result
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
  const componentSets = new Map<string, ComponentInfo>()

  for (const comp of components) {
    if (comp.type === 'COMPONENT_SET') {
      componentSets.set(comp.id, comp)
    }
  }

  for (const comp of components) {
    if (comp.type === 'COMPONENT_SET') continue

    let groupKey: string
    let baseName: string
    let isComponentSet = false
    let props: PropInfo[] | undefined
    let componentSetId: string | undefined

    if (comp.componentSetId) {
      groupKey = comp.componentSetId
      const setInfo = componentSets.get(comp.componentSetId)
      baseName = setInfo?.name || comp.name.split(',')[0].split('=')[0]
      isComponentSet = true
      componentSetId = comp.componentSetId
      if (setInfo?.componentPropertyDefinitions) {
        props = parseProps(setInfo.componentPropertyDefinitions)
      }
    } else if (comp.name.includes('/')) {
      baseName = comp.name.split('/')[0]
      groupKey = `name:${baseName}`
      // Check for TEXT properties on regular components
      if (comp.componentPropertyDefinitions) {
        const textProps = parseProps(comp.componentPropertyDefinitions).filter((p) => p.type === 'text')
        if (textProps.length > 0) {
          props = textProps
        }
      }
    } else {
      baseName = comp.name
      groupKey = `id:${comp.id}`
      // Check for TEXT properties on regular components
      if (comp.componentPropertyDefinitions) {
        const textProps = parseProps(comp.componentPropertyDefinitions).filter((p) => p.type === 'text')
        if (textProps.length > 0) {
          props = textProps
        }
      }
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { baseName, components: [], isComponentSet, props, componentSetId })
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

function generateComponentAST(
  componentName: string,
  props: PropInfo[],
  variants: Map<string, ts.JsxChild>,
  usedComponents: Set<string>,
  framework: FrameworkConfig
): ts.SourceFile {
  const statements: ts.Statement[] = []

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

  // interface Props { ... }
  const propsMembers = props.map((p) => {
    let typeNode: ts.TypeNode
    if (p.type === 'boolean') {
      typeNode = ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)
    } else if (p.type === 'text') {
      typeNode = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
    } else {
      typeNode = ts.factory.createUnionTypeNode(
        (p.options || []).map((o) => ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(o)))
      )
    }
    return ts.factory.createPropertySignature(
      undefined,
      p.camelName,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      typeNode
    )
  })

  statements.push(
    ts.factory.createInterfaceDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      `${componentName}Props`,
      undefined,
      undefined,
      propsMembers
    )
  )

  // Generate component function body
  const bodyStatements: ts.Statement[] = []
  const variantProps = props.filter((p) => p.type !== 'text')

  if (variantProps.length === 1 && variantProps[0].type === 'boolean') {
    // Simple boolean: if (prop) return <true> else return <false>
    const prop = variantProps[0]
    const trueKey = `${prop.name}=true`
    const falseKey = `${prop.name}=false`
    const trueJsx = variants.get(trueKey)
    const falseJsx = variants.get(falseKey)

    if (trueJsx && falseJsx) {
      bodyStatements.push(
        ts.factory.createIfStatement(
          ts.factory.createIdentifier(prop.camelName),
          ts.factory.createReturnStatement(trueJsx as ts.Expression),
          ts.factory.createReturnStatement(falseJsx as ts.Expression)
        )
      )
    }
  } else if (variantProps.length > 0) {
    // Multiple props: chain of if statements
    for (const [key, jsx] of variants) {
      const variantValues = parseVariantName(key)
      const conditions = variantProps.map((p) => {
        const value = variantValues[p.name]
        if (p.type === 'boolean') {
          return value === 'true'
            ? ts.factory.createIdentifier(p.camelName)
            : ts.factory.createPrefixUnaryExpression(
                ts.SyntaxKind.ExclamationToken,
                ts.factory.createIdentifier(p.camelName)
              )
        }
        return ts.factory.createBinaryExpression(
          ts.factory.createIdentifier(p.camelName),
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.factory.createStringLiteral(value)
        )
      })

      const condition = conditions.reduce((acc, cond) =>
        ts.factory.createBinaryExpression(acc, ts.SyntaxKind.AmpersandAmpersandToken, cond)
      )

      bodyStatements.push(
        ts.factory.createIfStatement(condition, ts.factory.createReturnStatement(jsx as ts.Expression))
      )
    }
    bodyStatements.push(ts.factory.createReturnStatement(ts.factory.createNull()))
  } else {
    // Only TEXT props, no variants - return first JSX
    const firstJsx = variants.values().next().value
    if (firstJsx) {
      bodyStatements.push(ts.factory.createReturnStatement(firstJsx as ts.Expression))
    }
  }

  // export function Component({ props }: Props) { ... }
  const funcParams = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    ts.factory.createObjectBindingPattern(
      props.map((p) =>
        ts.factory.createBindingElement(undefined, undefined, ts.factory.createIdentifier(p.camelName))
      )
    ),
    undefined,
    ts.factory.createTypeReferenceNode(`${componentName}Props`)
  )

  statements.push(
    ts.factory.createFunctionDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      undefined,
      componentName,
      undefined,
      [funcParams],
      undefined,
      ts.factory.createBlock(bodyStatements, true)
    )
  )

  return ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  )
}

function generateStorybookWithComponentAST(
  title: string,
  componentName: string,
  props: PropInfo[],
  variants: Array<{ name: string; propValues: Record<string, string> }>,
  framework: FrameworkConfig
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
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('StoryObj'))
        ])
      ),
      ts.factory.createStringLiteral(framework.storybookType)
    )
  )

  // import { Component } from './Component'
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(componentName))
        ])
      ),
      ts.factory.createStringLiteral(`./${componentName}`)
    )
  )

  // export default { title, component: Component } satisfies Meta<typeof Component>
  statements.push(
    ts.factory.createExportDefault(
      ts.factory.createSatisfiesExpression(
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment('title', ts.factory.createStringLiteral(title)),
          ts.factory.createPropertyAssignment('component', ts.factory.createIdentifier(componentName))
        ]),
        ts.factory.createTypeReferenceNode('Meta', [
          ts.factory.createTypeQueryNode(ts.factory.createIdentifier(componentName))
        ])
      )
    )
  )

  // export const Variant: StoryObj<typeof Component> = { args: { ... } }
  for (const variant of variants) {
    const argsProperties = props.map((p) => {
      // For TEXT props, use defaultValue; for VARIANT props, use propValues from variant name
      const value = p.type === 'text' ? p.defaultValue : variant.propValues[p.name]
      const valueExpr =
        p.type === 'boolean'
          ? value === 'true'
            ? ts.factory.createTrue()
            : ts.factory.createFalse()
          : ts.factory.createStringLiteral(value || '')
      return ts.factory.createPropertyAssignment(p.camelName, valueExpr)
    })

    statements.push(
      ts.factory.createVariableStatement(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              variantNameToIdentifier(variant.name),
              undefined,
              ts.factory.createTypeReferenceNode('StoryObj', [
                ts.factory.createTypeQueryNode(ts.factory.createIdentifier(componentName))
              ]),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  'args',
                  ts.factory.createObjectLiteralExpression(argsProperties)
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

  // export default { title } satisfies Meta
  statements.push(
    ts.factory.createExportDefault(
      ts.factory.createSatisfiesExpression(
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment('title', ts.factory.createStringLiteral(title))
        ]),
        ts.factory.createTypeReferenceNode('Meta')
      )
    )
  )

  // export const VariantName: StoryObj = { render: () => <...> }
  for (const variant of variants) {
    statements.push(
      ts.factory.createVariableStatement(
        [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              variantNameToIdentifier(variant.name),
              undefined,
              ts.factory.createTypeReferenceNode('StoryObj'),
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
  options: ProcessOptions,
  textPropMap?: Map<string, string>
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

  const jsx = nodeToJsx(node, { textPropMap })
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
  const { baseName, components: comps, isComponentSet, props } = group

  try {
    // ComponentSet with props → generate component + stories with args
    if (isComponentSet && props && props.length > 0) {
      return await exportComponentSet(baseName, comps, props, options, framework, formatOptions, outDir, printer)
    }

    // Regular components with TEXT props → generate component with text props
    const textProps = props?.filter((p) => p.type === 'text') || []
    if (textProps.length > 0 && comps.length === 1) {
      return await exportComponentWithTextProps(
        baseName,
        comps[0],
        textProps,
        options,
        framework,
        formatOptions,
        outDir,
        printer
      )
    }

    // Regular components → generate stories with render
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

async function exportComponentWithTextProps(
  baseName: string,
  comp: ComponentInfo,
  props: PropInfo[],
  options: ProcessOptions,
  framework: FrameworkConfig,
  formatOptions: FormatOptions,
  outDir: string,
  printer: ts.Printer
): Promise<ExportResult | ExportError> {
  const componentName = toPascalCase(baseName.replace(/\//g, ''))

  // Build textPropMap: textPropertyRef → camelName
  const textPropMap = new Map<string, string>()
  for (const prop of props) {
    textPropMap.set(prop.name, prop.camelName)
  }

  const result = await processComponent(comp, options, textPropMap)
  if (!result) {
    return { name: baseName, error: 'Failed to process component' }
  }

  // Generate component file with text props
  const componentFile = generateTextPropsComponentAST(componentName, props, result.jsx, result.usedComponents, framework)
  let componentCode = printer.printFile(componentFile)
  componentCode = await formatCode(componentCode, formatOptions)

  const componentPath = join(outDir, `${componentName}.tsx`)
  writeFileSync(componentPath, componentCode)

  // Generate stories file
  const storiesFile = generateStorybookWithTextPropsAST(baseName, componentName, props, framework)
  let storiesCode = printer.printFile(storiesFile)
  storiesCode = await formatCode(storiesCode, formatOptions)

  const storiesPath = join(outDir, `${componentName}.stories.tsx`)
  writeFileSync(storiesPath, storiesCode)

  return { name: baseName, file: storiesPath, variants: 1 }
}

function generateTextPropsComponentAST(
  componentName: string,
  props: PropInfo[],
  jsx: ts.JsxChild,
  usedComponents: Set<string>,
  framework: FrameworkConfig
): ts.SourceFile {
  const statements: ts.Statement[] = []

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

  // interface Props { label?: string, ... }
  const propsMembers = props.map((p) =>
    ts.factory.createPropertySignature(
      undefined,
      p.camelName,
      ts.factory.createToken(ts.SyntaxKind.QuestionToken),
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
    )
  )

  statements.push(
    ts.factory.createInterfaceDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      `${componentName}Props`,
      undefined,
      undefined,
      propsMembers
    )
  )

  // export function Component({ label = 'default', ... }: Props) { return <...> }
  const funcParams = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    ts.factory.createObjectBindingPattern(
      props.map((p) =>
        ts.factory.createBindingElement(
          undefined,
          undefined,
          ts.factory.createIdentifier(p.camelName),
          ts.factory.createStringLiteral(p.defaultValue)
        )
      )
    ),
    undefined,
    ts.factory.createTypeReferenceNode(`${componentName}Props`)
  )

  statements.push(
    ts.factory.createFunctionDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      undefined,
      componentName,
      undefined,
      [funcParams],
      undefined,
      ts.factory.createBlock([ts.factory.createReturnStatement(jsx as ts.Expression)], true)
    )
  )

  return ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  )
}

function generateStorybookWithTextPropsAST(
  title: string,
  componentName: string,
  props: PropInfo[],
  framework: FrameworkConfig
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
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('StoryObj'))
        ])
      ),
      ts.factory.createStringLiteral(framework.storybookType)
    )
  )

  // import { Component } from './Component'
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(componentName))
        ])
      ),
      ts.factory.createStringLiteral(`./${componentName}`)
    )
  )

  // export default { title, component } satisfies Meta<typeof Component>
  statements.push(
    ts.factory.createExportDefault(
      ts.factory.createSatisfiesExpression(
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment('title', ts.factory.createStringLiteral(title)),
          ts.factory.createPropertyAssignment('component', ts.factory.createIdentifier(componentName))
        ]),
        ts.factory.createTypeReferenceNode('Meta', [
          ts.factory.createTypeQueryNode(ts.factory.createIdentifier(componentName))
        ])
      )
    )
  )

  // export const Default: StoryObj<typeof Component> = { args: { label: 'default', ... } }
  const argsProperties = props.map((p) =>
    ts.factory.createPropertyAssignment(p.camelName, ts.factory.createStringLiteral(p.defaultValue))
  )

  statements.push(
    ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            'Default',
            undefined,
            ts.factory.createTypeReferenceNode('StoryObj', [
              ts.factory.createTypeQueryNode(ts.factory.createIdentifier(componentName))
            ]),
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment('args', ts.factory.createObjectLiteralExpression(argsProperties))
            ])
          )
        ],
        ts.NodeFlags.Const
      )
    )
  )

  return ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  )
}

async function exportComponentSet(
  baseName: string,
  comps: ComponentInfo[],
  props: PropInfo[],
  options: ProcessOptions,
  framework: FrameworkConfig,
  formatOptions: FormatOptions,
  outDir: string,
  printer: ts.Printer
): Promise<ExportResult | ExportError> {
  const componentName = toPascalCase(baseName)
  const variantJsxMap = new Map<string, ts.JsxChild>()
  const usedComponents = new Set<string>()
  const storyVariants: Array<{ name: string; propValues: Record<string, string> }> = []

  // Build textPropMap for TEXT properties
  const textPropMap = new Map<string, string>()
  for (const prop of props) {
    if (prop.type === 'text') {
      textPropMap.set(prop.name, prop.camelName)
    }
  }

  for (const comp of comps) {
    const result = await processComponent(comp, options, textPropMap)
    if (!result) continue

    for (const c of result.usedComponents) usedComponents.add(c)

    const propValues = parseVariantName(comp.name)
    const key = comp.name
    variantJsxMap.set(key, result.jsx)

    const storyName = props
      .filter((p) => p.type !== 'text') // Only VARIANT props in story name
      .map((p) => {
        const val = propValues[p.name]
        if (!val) return ''
        // Rename true/false to Checked/Unchecked for boolean checked prop
        if (p.camelName === 'checked' && p.type === 'boolean') {
          return val === 'true' ? 'Checked' : 'Unchecked'
        }
        return val.charAt(0).toUpperCase() + val.slice(1)
      })
      .filter(Boolean)
      .join('')
    storyVariants.push({ name: storyName || 'Default', propValues })
  }

  if (variantJsxMap.size === 0) {
    return { name: baseName, error: 'No variants exported' }
  }

  // Generate component file
  const componentFile = generateComponentAST(componentName, props, variantJsxMap, usedComponents, framework)
  let componentCode = printer.printFile(componentFile)
  componentCode = await formatCode(componentCode, formatOptions)

  const componentPath = join(outDir, `${componentName}.tsx`)
  writeFileSync(componentPath, componentCode)

  // Generate stories file
  const storiesFile = generateStorybookWithComponentAST(baseName, componentName, props, storyVariants, framework)
  let storiesCode = printer.printFile(storiesFile)
  storiesCode = await formatCode(storiesCode, formatOptions)

  const storiesPath = join(outDir, `${componentName}.stories.tsx`)
  writeFileSync(storiesPath, storiesCode)

  return { name: baseName, file: storiesPath, variants: storyVariants.length }
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
      closeCDP()
    } catch (e) {
      handleError(e)
    }
  }
})
