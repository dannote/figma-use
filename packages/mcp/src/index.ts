import ts from 'typescript'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface ToolDef extends Tool {
  pluginCommand: string
}

async function findCommandFiles(
  dir: string,
  prefix = ''
): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(
        ...(await findCommandFiles(fullPath, prefix ? `${prefix}_${entry.name}` : entry.name))
      )
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      const cmdName = entry.name.replace('.ts', '')
      files.push({
        path: fullPath,
        name: prefix ? `${prefix}_${cmdName}` : cmdName
      })
    }
  }

  return files
}

function parseCommandFile(content: string, name: string): ToolDef | null {
  const sourceFile = ts.createSourceFile('command.ts', content, ts.ScriptTarget.Latest, true)

  let description = ''
  let pluginCommand = ''
  const properties: Record<string, { type: string; description?: string }> = {}
  const required: string[] = []

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineCommand'
    ) {
      const arg = node.arguments[0]
      if (ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (!ts.isPropertyAssignment(prop)) continue
          const propName = prop.name.getText(sourceFile)

          if (propName === 'meta' && ts.isObjectLiteralExpression(prop.initializer)) {
            for (const metaProp of prop.initializer.properties) {
              if (
                ts.isPropertyAssignment(metaProp) &&
                metaProp.name.getText(sourceFile) === 'description'
              ) {
                if (ts.isStringLiteral(metaProp.initializer)) {
                  description = metaProp.initializer.text
                }
              }
            }
          }

          if (propName === 'args' && ts.isObjectLiteralExpression(prop.initializer)) {
            for (const argProp of prop.initializer.properties) {
              if (!ts.isPropertyAssignment(argProp)) continue
              const argName = argProp.name.getText(sourceFile)
              if (argName === 'json') continue

              if (ts.isObjectLiteralExpression(argProp.initializer)) {
                let type = 'string'
                let argDesc: string | undefined
                let isRequired = false

                for (const p of argProp.initializer.properties) {
                  if (!ts.isPropertyAssignment(p)) continue
                  const pName = p.name.getText(sourceFile)

                  if (pName === 'type' && ts.isStringLiteral(p.initializer)) {
                    const t = p.initializer.text
                    type = t === 'boolean' ? 'boolean' : 'string'
                  }
                  if (pName === 'description' && ts.isStringLiteral(p.initializer)) {
                    argDesc = p.initializer.text
                  }
                  if (pName === 'required' && p.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    isRequired = true
                  }
                }

                properties[argName] = { type, description: argDesc }
                if (isRequired) required.push(argName)
              }
            }
          }
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'sendCommand'
    ) {
      const firstArg = node.arguments[0]
      if (ts.isStringLiteral(firstArg)) {
        pluginCommand = firstArg.text
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!description || !pluginCommand) return null

  return {
    name: `figma_${name}`,
    description,
    inputSchema: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    },
    pluginCommand
  }
}

let cachedTools: ToolDef[] | null = null

export async function getTools(): Promise<ToolDef[]> {
  if (cachedTools) return cachedTools

  const commandsDir = join(import.meta.dir, '../../cli/src/commands')
  const files = await findCommandFiles(commandsDir)

  const tools: ToolDef[] = []
  const skipFiles = ['proxy', 'plugin', 'status', 'mcp', 'profile', 'render']

  for (const { path, name } of files) {
    if (skipFiles.some((s) => name === s || name.startsWith(s + '_'))) continue

    const content = await readFile(path, 'utf-8')
    const tool = parseCommandFile(content, name)
    if (tool) {
      tools.push(tool)
    }
  }

  // Add status tool manually
  tools.unshift({
    name: 'figma_status',
    description: 'Check if Figma plugin is connected',
    inputSchema: { type: 'object', properties: {} },
    pluginCommand: '__status__'
  })

  // Add render tool (uses multiplayer protocol, not plugin command)
  tools.push({
    name: 'figma_render',
    description: 'Render JSX to Figma. Pure JSX only (no variables, no logic). Elements: Frame, Rectangle, Ellipse, Text, Line, Star, Polygon, Vector, Group, Icon. Style shorthands: w, h, bg, rounded, p, px, py, flex, gap, justify, items, size, weight, color.',
    inputSchema: {
      type: 'object',
      properties: {
        jsx: { type: 'string', description: 'JSX code to render (e.g., <Frame style={{w: 200, h: 100, bg: "#FF0000"}} />)' },
        x: { type: 'string', description: 'X position of rendered root' },
        y: { type: 'string', description: 'Y position of rendered root' },
        parent: { type: 'string', description: 'Parent node ID (sessionID:localID)' }
      },
      required: ['jsx']
    },
    pluginCommand: '__render__'
  })

  cachedTools = tools
  return tools
}

export function getToolByName(name: string): ToolDef | undefined {
  return cachedTools?.find((t) => t.name === name)
}
