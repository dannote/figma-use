import { describe, expect, test } from 'bun:test'

import {
  getRpcInjectionStrategyOrder,
  injectRpcBundleWithFallback,
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
})
