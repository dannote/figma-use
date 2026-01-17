const PROXY_URL = process.env.FIGMA_PROXY_URL || 'http://localhost:38451'

export async function sendCommand<T = unknown>(command: string, args?: unknown): Promise<T> {
  const response = await fetch(`${PROXY_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args })
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

export function printResult(result: unknown): void {
  console.log(JSON.stringify(result, null, 2))
}

export function handleError(error: unknown): never {
  console.error('Error:', error instanceof Error ? error.message : error)
  process.exit(1)
}
