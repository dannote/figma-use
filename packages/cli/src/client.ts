export { printResult, printError, formatResult } from './output.ts'

const PROXY_URL = process.env.FIGMA_PROXY_URL || 'http://localhost:38451'

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
  const data = (await response.json()) as { result?: T; error?: string }
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
