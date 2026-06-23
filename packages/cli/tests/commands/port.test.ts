import { describe, test, expect } from 'bun:test'
import { join } from 'path'

// dist/ lives at the repo root. Resolve from the test file's own location
// (packages/cli/tests/commands/) so the path is stable regardless of cwd:
// commands → tests → cli → packages → root = 4 levels up.
const CLI_BIN = join(import.meta.dir, '../../../../dist/cli/index.js')

// getCdpPort caches its result, so each scenario runs in a fresh subprocess
// with a controlled argv. This also mirrors how the flag is actually parsed
// in real CLI invocations.
async function runWithArgs(args: string[], env?: Record<string, string>): Promise<string> {
  const proc = Bun.spawn([process.execPath, CLI_BIN, 'status', ...args], {
    cwd: import.meta.dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env }
  })
  return await new Response(proc.stdout).text()
}

async function runCli(args: string[], env?: Record<string, string>): Promise<string> {
  const proc = Bun.spawn([process.execPath, CLI_BIN, ...args], {
    cwd: import.meta.dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env }
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  await proc.exited
  return stdout + stderr
}

describe('custom CDP port', () => {
  test('--port <N> is reflected in the connection hint', async () => {
    const out = await runWithArgs(['--port', '9555'])
    expect(out).toContain('remote-debugging-port=9555')
  })

  test('--port=<N> form works', async () => {
    const out = await runWithArgs(['--port=8444'])
    expect(out).toContain('remote-debugging-port=8444')
  })

  test('root-level --port <N> before command works', async () => {
    const out = await runCli(['--port', '9556', 'status'])
    expect(out).toContain('remote-debugging-port=9556')
  })

  test('root-level --port=<N> before command works', async () => {
    const out = await runCli(['--port=9557', 'status'])
    expect(out).toContain('remote-debugging-port=9557')
  })

  test('FIGMA_PORT env is used when no flag is given', async () => {
    const out = await runWithArgs([], { FIGMA_PORT: '7331' })
    expect(out).toContain('remote-debugging-port=7331')
  })

  test('--port flag takes precedence over FIGMA_PORT env', async () => {
    const out = await runWithArgs(['--port', '6000'], { FIGMA_PORT: '7000' })
    expect(out).toContain('remote-debugging-port=6000')
    expect(out).not.toContain('remote-debugging-port=7000')
  })

  test('defaults to 9222 when nothing is specified', async () => {
    const out = await runWithArgs([], { FIGMA_PORT: '' })
    expect(out).toContain('remote-debugging-port=9222')
  })
})
