import { describe, expect, test } from 'bun:test'

import {
  getRpcInjectionStrategyOrder,
  injectRpcBundleWithFallback,
  injectRpcBundleWithRetry,
  isTransientBootstrapError,
  wrapRpcBundle
} from '../src/rpc-bootstrap.ts'

describe('rpc bootstrap', () => {
  test('prefers legacy strategy by default', () => {
    expect(getRpcInjectionStrategyOrder()).toEqual(['legacy', 'bootstrapped'])
  })

  test('prefers last known bootstrapped strategy when requested', () => {
    expect(getRpcInjectionStrategyOrder('bootstrapped')).toEqual(['bootstrapped', 'legacy'])
  })

  test('uses legacy injection when health check passes', async () => {
    const calls: string[] = []
    let bootstrapped = false

    const strategy = await injectRpcBundleWithFallback({
      code: 'legacy bundle',
      hash: 'abc123',
      evaluate: async <T>(code: string) => {
        calls.push(code)
        if (code === 'typeof window.__figmaRpc === "function"') return true as T
        if (code === 'window.__figmaRpc("get-current-page", undefined)') {
          return { id: '1:1', name: 'Page 1' } as T
        }
        return undefined as T
      },
      ensureFigmaApi: async () => {
        bootstrapped = true
      }
    })

    expect(strategy).toBe('legacy')
    expect(bootstrapped).toBe(false)
    expect(calls).toContain('legacy bundle')
    expect(calls).not.toContain(wrapRpcBundle('legacy bundle'))
  })

  test('falls back to bootstrapped injection when legacy probe fails', async () => {
    const calls: string[] = []
    let legacyInjected = false
    let bootstrapped = 0

    const strategy = await injectRpcBundleWithFallback({
      code: 'legacy bundle',
      hash: 'def456',
      evaluate: async <T>(code: string) => {
        calls.push(code)

        if (code === 'legacy bundle') {
          legacyInjected = true
          return undefined as T
        }

        if (code === 'typeof window.__figmaRpc === "function"') return true as T

        if (code === 'window.__figmaRpc("get-current-page", undefined)') {
          if (legacyInjected && bootstrapped === 0) {
            throw new Error("Cannot read properties of undefined (reading 'currentPage')")
          }
          return { id: '1:2', name: 'Fallback Page' } as T
        }

        return undefined as T
      },
      ensureFigmaApi: async () => {
        bootstrapped++
      }
    })

    expect(strategy).toBe('bootstrapped')
    expect(bootstrapped).toBe(1)
    expect(calls).toContain('legacy bundle')
    expect(calls).toContain(wrapRpcBundle('legacy bundle'))
  })

  test('includes both strategy failures in the error', async () => {
    await expect(
      injectRpcBundleWithFallback({
        code: 'legacy bundle',
        hash: 'ghi789',
        evaluate: async () => {
          throw new Error('boom')
        },
        ensureFigmaApi: async () => {}
      })
    ).rejects.toThrow('legacy: boom')

    await expect(
      injectRpcBundleWithFallback({
        code: 'legacy bundle',
        hash: 'ghi789',
        evaluate: async () => {
          throw new Error('boom')
        },
        ensureFigmaApi: async () => {}
      })
    ).rejects.toThrow('bootstrapped: boom')
  })

  test('retries transient Figma 126.12+ PluginHelpers/cold-bundle errors until ready', async () => {
    let attempts = 0
    const sleeps: number[] = []

    const strategy = await injectRpcBundleWithRetry({
      code: 'legacy bundle',
      hash: 'retry123',
      intervalMs: 10,
      timeoutMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      evaluate: async <T>(code: string) => {
        if (code === 'legacy bundle') {
          throw new Error('ReferenceError: figma is not defined')
        }
        if (code === 'typeof window.__figmaRpc === "function"') return true as T
        if (code === 'window.__figmaRpc("get-current-page", undefined)') {
          return { id: '0:1', name: 'Page 1' } as T
        }
        return undefined as T
      },
      ensureFigmaApi: async () => {
        attempts++
        if (attempts === 1) throw new Error("TypeError: Cannot read properties of undefined (reading 'push')")
        if (attempts === 2) throw new Error('Error: PluginHelpers is not initialized')
      }
    })

    expect(strategy).toBe('bootstrapped')
    expect(attempts).toBe(3)
    expect(sleeps).toEqual([10, 10])
    expect(isTransientBootstrapError('Error: PluginHelpers is not initialized')).toBe(true)
    expect(isTransientBootstrapError('Error: unrelated failure')).toBe(false)
  })
})
