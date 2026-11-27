export type RpcInjectionStrategy = 'legacy' | 'bootstrapped'

export interface InjectRpcBundleOptions {
  code: string
  hash: string
  preferredStrategy?: RpcInjectionStrategy | null
  evaluate: <T = unknown>(code: string, timeout?: number) => Promise<T>
  ensureFigmaApi: () => Promise<void>
}

const RPC_READY_CHECK = 'typeof window.__figmaRpc === "function"'
const RPC_HEALTH_CHECK = 'window.__figmaRpc("get-current-page", undefined)'
const RPC_RESET = 'delete window.__figmaRpc; delete window.__figmaRpcHash'

export function getRpcInjectionStrategyOrder(
  preferredStrategy?: RpcInjectionStrategy | null
): RpcInjectionStrategy[] {
  return preferredStrategy === 'bootstrapped'
    ? ['bootstrapped', 'legacy']
    : ['legacy', 'bootstrapped']
}

export function wrapRpcBundle(code: string): string {
  return `;(function(figma) {\n${code}\n})(window.__figmaPluginApi);`
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function injectRpcBundleWithFallback({
  code,
  hash,
  preferredStrategy,
  evaluate,
  ensureFigmaApi
}: InjectRpcBundleOptions): Promise<RpcInjectionStrategy> {
  const attempts = getRpcInjectionStrategyOrder(preferredStrategy)
  const failures: string[] = []

  for (const strategy of attempts) {
    try {
      try {
        await evaluate(RPC_RESET)
      } catch {
        // Best-effort cleanup between attempts
      }

      if (strategy === 'bootstrapped') {
        await ensureFigmaApi()
        await evaluate(wrapRpcBundle(code))
      } else {
        await evaluate(code)
      }

      await evaluate(`window.__figmaRpcHash = ${JSON.stringify(hash)}`)

      const ready = await evaluate<boolean>(RPC_READY_CHECK)
      if (!ready) {
        throw new Error('window.__figmaRpc was not defined')
      }

      await evaluate(RPC_HEALTH_CHECK)
      return strategy
    } catch (error) {
      failures.push(`${strategy}: ${formatError(error)}`)
    }
  }

  throw new Error(`Failed to inject RPC into Figma (${failures.join(' | ')})`)
}

export interface RetryRpcBootstrapOptions extends InjectRpcBundleOptions {
  timeoutMs?: number
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

export function isTransientBootstrapError(error: unknown): boolean {
  const msg = formatError(error)
  return (
    msg.includes('PluginHelpers is not initialized') ||
    msg.includes("reading 'push'") ||
    msg.includes('figma is not defined') ||
    msg.includes('Could not find defineVmFunction') ||
    msg.includes('Execution context was destroyed')
  )
}

export async function injectRpcBundleWithRetry({
  timeoutMs = 30000,
  intervalMs = 1000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ...options
}: RetryRpcBootstrapOptions): Promise<RpcInjectionStrategy> {
  for (let waited = 0; ; waited += intervalMs) {
    try {
      return await injectRpcBundleWithFallback(options)
    } catch (error) {
      if (!isTransientBootstrapError(error) || waited >= timeoutMs) {
        throw error
      }
      await sleep(intervalMs)
    }
  }
}
