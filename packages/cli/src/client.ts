import { createHash } from 'crypto'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { cdpEval } from './cdp.ts'
import { isDaemonAvailable, callDaemon } from './daemon/index.ts'

export { printResult, printError, formatResult } from './output.ts'
export { getFileKey } from './cdp.ts'

let rpcInjected = false
let currentRpcHash: string | null = null
let useDaemon: boolean | null = null
let esbuildModule: typeof import('esbuild') | null = null

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

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs'
import { tmpdir } from 'os'

const RPC_CACHE_PATH = join(tmpdir(), 'figma-use-rpc-cache.json')

async function buildRpcBundle(): Promise<{ code: string; hash: string }> {
  const pluginDir = getPluginDir()
  const entryPoint = join(pluginDir, 'rpc.ts')

  // Check cache - if rpc.ts hasn't changed, use cached bundle
  const rpcStat = statSync(entryPoint)
  const rpcMtime = rpcStat.mtimeMs

  if (existsSync(RPC_CACHE_PATH)) {
    try {
      const cache = JSON.parse(readFileSync(RPC_CACHE_PATH, 'utf-8'))
      if (cache.mtime === rpcMtime && cache.code && cache.hash) {
        return { code: cache.code, hash: cache.hash }
      }
    } catch {
      // Cache corrupted, rebuild
    }
  }

  // Lazy load esbuild only when needed
  if (!esbuildModule) {
    esbuildModule = await import('esbuild')
  }

  const result = await esbuildModule.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    minify: true
  })

  const code = result.outputFiles![0]!.text
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16)

  // Save to cache
  try {
    writeFileSync(RPC_CACHE_PATH, JSON.stringify({ mtime: rpcMtime, code, hash }))
  } catch {
    // Ignore cache write errors
  }

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

// Direct command - used by daemon, no daemon check to avoid loops
export async function sendCommandDirect<T = unknown>(
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

export async function sendCommand<T = unknown>(
  command: string,
  args?: unknown,
  options?: { timeout?: number }
): Promise<T> {
  // Try daemon first (much faster for sequential commands)
  if (useDaemon === null) {
    useDaemon = isDaemonAvailable()
  }

  if (useDaemon) {
    try {
      return await callDaemon<T>(command, args)
    } catch {
      // Daemon failed, fall back to direct connection
      useDaemon = false
    }
  }

  return sendCommandDirect<T>(command, args, options)
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
