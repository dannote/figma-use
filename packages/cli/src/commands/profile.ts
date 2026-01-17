import { defineCommand } from 'citty'
import { ok, fail } from '../format.ts'
import { spawn } from 'child_process'
import { resolve } from 'path'

export default defineCommand({
  meta: { description: 'Profile any figma-use command via Chrome DevTools Protocol' },
  args: {
    command: { type: 'positional', description: 'Command to profile (e.g., "get components --limit 10")', required: true },
    port: { type: 'string', description: 'Chrome DevTools port', default: '9222' },
    top: { type: 'string', description: 'Number of top functions to show', default: '20' }
  },
  async run({ args }) {
    const port = Number(args.port)
    const topN = Number(args.top)

    // Find Figma tab
    const targets = await fetch(`http://localhost:${port}/json`).then(r => r.json()).catch(() => null)
    if (!targets) {
      console.error(fail(`Cannot connect to DevTools on port ${port}`))
      console.error(`Start Figma with: /Applications/Figma.app/Contents/MacOS/Figma --remote-debugging-port=${port}`)
      process.exit(1)
    }

    const figmaTab = targets.find((t: any) => t.title?.includes('Figma') && t.type === 'page' && t.url?.includes('figma.com/design'))
    if (!figmaTab) {
      console.error(fail('No Figma design tab found. Open a Figma file first.'))
      process.exit(1)
    }

    console.log(`Profiling: figma-use ${args.command}`)
    console.log(`Target: ${figmaTab.title}\n`)

    // Connect via WebSocket
    const ws = new WebSocket(figmaTab.webSocketDebuggerUrl)
    let msgId = 1
    const pending = new Map<number, (data: any) => void>()

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string)
      const resolve = pending.get(data.id)
      if (resolve) {
        pending.delete(data.id)
        resolve(data)
      }
    }

    const send = (method: string, params: any = {}): Promise<any> => {
      const id = msgId++
      return new Promise(resolve => {
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    await new Promise<void>(r => { ws.onopen = () => r() })

    // Enable and start profiler
    await send('Profiler.enable')
    await send('Profiler.start')

    const startTime = Date.now()

    // Run the actual CLI command using the same binary
    const cmdResult = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
      const proc = spawn(process.argv[0], [process.argv[1], ...args.command.split(' '), '--json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => stdout += d)
      proc.stderr.on('data', (d) => stderr += d)
      proc.on('close', (code) => resolve({ stdout, stderr, code: code || 0 }))
    })

    const duration = Date.now() - startTime

    // Stop profiling
    const profile = await send('Profiler.stop')
    ws.close()

    // Parse result
    let resultItems = 'N/A'
    let resultError = ''
    try {
      const parsed = JSON.parse(cmdResult.stdout)
      if (Array.isArray(parsed)) resultItems = String(parsed.length)
      else if (parsed.error) resultError = parsed.error
    } catch {
      if (cmdResult.stderr) resultError = cmdResult.stderr.trim()
    }

    // Results summary
    console.log(`Duration: ${duration}ms`)
    console.log(`Result: ${resultItems} items`)
    if (resultError) console.log(`Error: ${resultError}`)
    if (cmdResult.code !== 0) console.log(`Exit code: ${cmdResult.code}`)
    console.log()

    // Analyze profile
    const nodes = profile.result.profile.nodes
    const samples = profile.result.profile.samples || []
    const timeDeltas = profile.result.profile.timeDeltas || []

    const counts: Record<number, number> = {}
    samples.forEach((nodeId: number, idx: number) => {
      counts[nodeId] = (counts[nodeId] || 0) + (timeDeltas[idx] || 1)
    })

    // Categorize time
    let wasmTime = 0, gcTime = 0, idleTime = 0, jsTime = 0
    for (const [nodeId, time] of Object.entries(counts)) {
      const node = nodes.find((n: any) => n.id === parseInt(nodeId))
      const name = node?.callFrame?.functionName || ''
      const url = node?.callFrame?.url || ''
      if (name === '(garbage collector)') gcTime += time as number
      else if (name === '(idle)') idleTime += time as number
      else if (url.includes('.wasm')) wasmTime += time as number
      else jsTime += time as number
    }

    const total = wasmTime + gcTime + jsTime
    if (total > 0) {
      console.log('Time breakdown:')
      console.log(`  Figma WASM:  ${(wasmTime/1000).toFixed(0).padStart(5)}ms  (${(wasmTime/total*100).toFixed(0)}%)`)
      console.log(`  GC:          ${(gcTime/1000).toFixed(0).padStart(5)}ms  (${(gcTime/total*100).toFixed(0)}%)`)
      console.log(`  JS:          ${(jsTime/1000).toFixed(0).padStart(5)}ms  (${(jsTime/total*100).toFixed(0)}%)`)
      console.log(`  Idle:        ${(idleTime/1000).toFixed(0).padStart(5)}ms`)
      console.log()
    }

    // Top functions
    const funcs = Object.entries(counts)
      .map(([nodeId, time]) => {
        const node = nodes.find((n: any) => n.id === parseInt(nodeId))
        const cf = node?.callFrame || {}
        return {
          name: cf.functionName || '(anonymous)',
          url: cf.url || '',
          line: cf.lineNumber || 0,
          time: time as number
        }
      })
      .filter(f => f.time > 500 && f.name !== '(idle)')
      .sort((a, b) => b.time - a.time)
      .slice(0, topN)

    if (funcs.length > 0) {
      console.log(`Top ${Math.min(topN, funcs.length)} functions by CPU time:`)
      console.log('─'.repeat(75))
      for (const f of funcs) {
        const shortUrl = f.url.split('/').pop()?.slice(0, 25) || ''
        const loc = shortUrl ? `${shortUrl}:${f.line}` : ''
        console.log(`${(f.time/1000).toFixed(1).padStart(7)}ms  ${f.name.slice(0, 40).padEnd(40)}  ${loc}`)
      }
      console.log()
    }

    console.log(ok('Profile complete'))
  }
})
