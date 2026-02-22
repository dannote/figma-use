import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  pluginCommand: string
}

let cachedTools: ToolDef[] | null = null

export async function getTools(): Promise<ToolDef[]> {
  if (cachedTools) return cachedTools

  const currentDir = dirname(fileURLToPath(import.meta.url))

  // Try bundled JSON first (dist/mcp-tools.json), then walk up from various locations
  const candidates = [
    join(currentDir, '../mcp-tools.json'),
    join(currentDir, '../../dist/mcp-tools.json'),
    join(currentDir, '../../../dist/mcp-tools.json')
  ]

  for (const path of candidates) {
    try {
      cachedTools = JSON.parse(readFileSync(path, 'utf-8'))
      return cachedTools!
    } catch {}
  }

  throw new Error(
    'MCP tool definitions not found. Run `bun run build` first.'
  )
}

export async function getToolByName(name: string): Promise<ToolDef | undefined> {
  const tools = await getTools()
  return tools.find((t) => t.name === name)
}
