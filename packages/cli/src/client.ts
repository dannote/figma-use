import type { ChromeDevToolsTarget } from './types.ts'

export { printResult, printError, formatResult } from './output.ts'

const PROXY_URL = process.env.FIGMA_PROXY_URL || 'http://localhost:38451'

interface CommandResponse<T> {
  result?: T
  error?: string
}

export async function sendCommand<T = unknown>(
  command: string, 
  args?: unknown, 
  options?: { timeout?: number }
): Promise<T> {
  const response = await fetch(`${PROXY_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args, timeout: options?.timeout })
  })
  const data = (await response.json()) as CommandResponse<T>
  if (data.error) {
    throw new Error(data.error)
  }
  return data.result as T
}

export async function getStatus(): Promise<{ pluginConnected: boolean }> {
  const response = await fetch(`${PROXY_URL}/status`)
  return response.json() as Promise<{ pluginConnected: boolean }>
}

export function handleError(error: unknown): never {
  const { printError } = require('./output.ts')
  printError(error)
  process.exit(1)
}

/**
 * Get current Figma file key from Chrome DevTools
 */
export async function getFileKey(): Promise<string> {
  try {
    const response = await fetch('http://localhost:9222/json')
    const targets = await response.json() as ChromeDevToolsTarget[]
    
    for (const target of targets) {
      const match = target.url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
      if (match?.[1]) return match[1]
    }
  } catch {
    // DevTools not available
  }
  
  throw new Error('No Figma file found. Start Figma with: figma --remote-debugging-port=9222')
}

/**
 * Get current page GUID for multiplayer
 */
export async function getParentGUID(): Promise<{ sessionID: number; localID: number }> {
  const result = await sendCommand<{ id: string }>('eval', { 
    code: 'return { id: figma.currentPage.id }' 
  })
  const parts = result.id.split(':').map(Number)
  return { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 }
}
