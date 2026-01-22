import { createHash } from 'crypto'
import * as esbuild from 'esbuild'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { cdpEval } from './cdp.ts'

export { printResult, printError, formatResult } from './output.ts'
export { getFileKey } from './cdp.ts'

let rpcInjected = false
let currentRpcHash: string | null = null

function getPluginDir(): string {
  // Works both in dev (src/) and bundled (dist/)
  const currentFile = fileURLToPath(import.meta.url)
  const cliDir = dirname(currentFile)

  // From packages/cli/src/
  if (cliDir.includes('packages/cli/src')) {
    return join(cliDir, '../../plugin/src')
  }
  // From packages/cli/ (without src)
  if (cliDir.includes('packages/cli')) {
    return join(cliDir, '../plugin/src')
  }
  // Bundled dist/cli/ - go up to repo root
  return join(cliDir, '../../packages/plugin/src')
}

async function buildRpcBundle(): Promise<{ code: string; hash: string }> {
  const pluginDir = getPluginDir()
  const entryPoint = join(pluginDir, 'rpc.ts')

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    minify: true
  })

  const code = result.outputFiles![0]!.text
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16)

  return { code, hash }
}

async function ensureRpcInjected(): Promise<void> {
  const { code, hash } = await buildRpcBundle()

  // Check if RPC is already injected with same version
  if (rpcInjected && currentRpcHash === hash) {
    const remoteHash = await cdpEval<string | undefined>('window.__figmaRpcHash')
    if (remoteHash === hash) return
  }

  // Inject fresh RPC
  await cdpEval(code)
  await cdpEval(`window.__figmaRpcHash = ${JSON.stringify(hash)}`)

  const ready = await cdpEval<boolean>('typeof window.__figmaRpc === "function"')
  if (!ready) {
    throw new Error('Failed to inject RPC into Figma')
  }

  rpcInjected = true
  currentRpcHash = hash
}

export async function sendCommand<T = unknown>(
  command: string,
  args?: unknown,
  options?: { timeout?: number }
): Promise<T> {
  await ensureRpcInjected()

  const code = `window.__figmaRpc(${JSON.stringify(command)}, ${JSON.stringify(args)})`

  const result = await cdpEval<T | { __error: string }>(code, options?.timeout || 30000)

  if (result && typeof result === 'object' && '__error' in result) {
    throw new Error((result as { __error: string }).__error)
  }

  return result as T
}

export async function getStatus(): Promise<{
  connected: boolean
  fileName?: string
}> {
  try {
    await ensureRpcInjected()
    const fileName = await cdpEval<string>('figma.root.name')
    return { connected: true, fileName }
  } catch {
    return { connected: false }
  }
}

export function handleError(error: unknown): never {
  const { printError } = require('./output.ts')
  printError(error)
  process.exit(1)
}

export async function getParentGUID(): Promise<{ sessionID: number; localID: number }> {
  await ensureRpcInjected()
  const id = await cdpEval<string>('figma.currentPage.id')
  const parts = id.split(':').map(Number)
  return { sessionID: parts[0] ?? 0, localID: parts[1] ?? 0 }
}
