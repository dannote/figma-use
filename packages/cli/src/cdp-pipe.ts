import { spawn, type ChildProcess } from 'child_process'
import type { Readable, Writable } from 'stream'

import { figmaBinaryPath } from './format.ts'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let figmaProcess: ChildProcess | null = null
let pipeIn: Writable | null = null
let pipeOut: Readable | null = null
let messageId = 0
let sessionId: string | null = null
let pendingBuffer = ''
let targetUrl: string | null = null

const pendingRequests = new Map<number, PendingRequest>()

function handleData(chunk: Buffer): void {
  const data = pendingBuffer + chunk.toString('utf8')
  let delimiterIndex = data.indexOf('\0')

  if (delimiterIndex === -1) {
    pendingBuffer = data
    return
  }

  let cursor = 0
  while (delimiterIndex !== -1) {
    const rawMessage = data.slice(cursor, delimiterIndex)
    cursor = delimiterIndex + 1

    if (rawMessage.trim()) {
      try {
        const parsed = JSON.parse(rawMessage)
        if (typeof parsed.id === 'number') {
          const pending = pendingRequests.get(parsed.id)
          if (pending) {
            pendingRequests.delete(parsed.id)
            clearTimeout(pending.timer)
            if (parsed.error) {
              pending.reject(new Error(parsed.error.message || 'CDP error'))
            } else {
              pending.resolve(parsed.result)
            }
          }
        }
      } catch {
        // Ignore parse errors from partial/malformed messages
      }
    }

    delimiterIndex = data.indexOf('\0', cursor)
  }

  pendingBuffer = data.slice(cursor)
}

function pipeSend(
  method: string,
  params?: Record<string, unknown>,
  timeout = 10000,
  sid?: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!pipeIn) {
      reject(new Error('Pipe not connected'))
      return
    }

    const id = ++messageId
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`CDP pipe timeout: ${method}`))
    }, timeout)

    pendingRequests.set(id, { resolve, reject, timer })

    const message: Record<string, unknown> = { id, method, params: params || {} }
    if (sid) message.sessionId = sid

    pipeIn.write(JSON.stringify(message) + '\0')
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface TargetInfo {
  targetId: string
  type: string
  title: string
  url: string
}

async function findFigmaPageTarget(
  attempts: number,
  delayMs: number
): Promise<TargetInfo | null> {
  for (let i = 0; i < attempts; i++) {
    const result = (await pipeSend('Target.getTargets', {}, 8000)) as {
      targetInfos: TargetInfo[]
    }

    const targets = result.targetInfos || []
    const figmaTarget =
      targets.find(
        (t) =>
          t.type === 'page' &&
          (t.url.includes('figma.com/design') || t.url.includes('figma.com/file'))
      ) ||
      targets.find((t) => t.type === 'page' && t.url.includes('figma.com/board')) ||
      targets.find((t) => t.type === 'page' && t.url.includes('figma.com'))

    if (figmaTarget) return figmaTarget
    await sleep(delayMs)
  }
  return null
}

export async function ensurePipeConnected(): Promise<void> {
  if (figmaProcess && sessionId) return

  if (!figmaProcess) {
    const binPath = process.env.FIGMA_BIN || figmaBinaryPath()
    if (!binPath) {
      throw new Error('Cannot detect Figma binary path. Set FIGMA_BIN env var.')
    }

    figmaProcess = spawn(binPath, ['--remote-debugging-pipe'], {
      stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'],
      detached: false
    })

    figmaProcess.on('exit', (code) => {
      figmaProcess = null
      pipeIn = null
      pipeOut = null
      sessionId = null
      targetUrl = null
      for (const [, pending] of pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error(`Figma exited (code ${code})`))
      }
      pendingRequests.clear()
    })

    pipeIn = figmaProcess.stdio[3] as Writable
    pipeOut = figmaProcess.stdio[4] as Readable

    if (!pipeIn || !pipeOut) {
      figmaProcess.kill('SIGTERM')
      figmaProcess = null
      throw new Error('Failed to open debug pipes (fd 3/4)')
    }

    pipeOut.on('data', handleData)

    // Wait for Figma to initialize
    await sleep(2000)

    // Verify pipe is working
    try {
      await pipeSend('Browser.getVersion', {}, 8000)
    } catch {
      throw new Error('Figma started but debug pipe is not responding')
    }
  }

  // Attach to a Figma page target
  const target = await findFigmaPageTarget(15, 2000)
  if (!target) {
    throw new Error('No Figma file open. Open a file in Figma and try again.')
  }

  targetUrl = target.url
  const attached = (await pipeSend('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true
  })) as { sessionId: string }

  sessionId = attached.sessionId
  await pipeSend('Runtime.enable', {}, 8000, sessionId)
}

export async function pipeEval<T>(code: string, timeout = 30000): Promise<T> {
  await ensurePipeConnected()

  try {
    return await pipeEvalInner<T>(code, timeout)
  } catch (e) {
    // Session may have been lost (tab closed/navigated) — try to re-attach once
    if (e instanceof Error && e.message.includes('pipe timeout')) {
      sessionId = null
      targetUrl = null
      await ensurePipeConnected()
      return pipeEvalInner<T>(code, timeout)
    }
    throw e
  }
}

async function pipeEvalInner<T>(code: string, timeout: number): Promise<T> {
  const result = (await pipeSend(
    'Runtime.evaluate',
    {
      expression: code,
      awaitPromise: true,
      returnByValue: true
    },
    timeout,
    sessionId!
  )) as {
    result?: { value: T }
    exceptionDetails?: { exception?: { description?: string }; text?: string }
  }

  if (result.exceptionDetails) {
    const err = result.exceptionDetails
    throw new Error(err.exception?.description || err.text || 'CDP error')
  }

  return result.result?.value as T
}

export function getPipeFileKey(): string | null {
  if (!targetUrl) return null
  const match = targetUrl.match(/\/(file|design)\/([a-zA-Z0-9]+)/)
  return match?.[2] || null
}

export function closePipe(): void {
  if (sessionId && pipeIn) {
    try {
      const id = ++messageId
      const msg = JSON.stringify({
        id,
        method: 'Target.detachFromTarget',
        params: { sessionId }
      })
      pipeIn.write(msg + '\0')
    } catch {
      // Best effort detach
    }
  }

  sessionId = null
  targetUrl = null

  if (pipeOut) {
    pipeOut.removeAllListeners('data')
  }

  // Kill the Figma process we spawned
  if (figmaProcess) {
    figmaProcess.kill('SIGTERM')
    figmaProcess = null
  }

  pipeIn = null
  pipeOut = null

  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Pipe closed'))
  }
  pendingRequests.clear()
  pendingBuffer = ''
}

export function isPipeConnected(): boolean {
  return figmaProcess !== null && sessionId !== null
}
