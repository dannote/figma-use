const CLI = 'bun run src/index.ts'
const cwd = import.meta.dir + '/..'

export async function run(cmd: string, parseJson: boolean = true): Promise<unknown> {
  const proc = Bun.spawn(['sh', '-c', `${CLI} ${cmd}`], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  await proc.exited
  if (proc.exitCode !== 0) throw new Error(stderr || stdout)
  if (!parseJson) return stdout.trim()
  try {
    return JSON.parse(stdout)
  } catch {
    return stdout.trim()
  }
}

let trackedNodes: string[] = []

export function trackNode(id: string) {
  trackedNodes.push(id)
}

let testPageId: string | null = null
let originalPageId: string | null = null

export async function setupTestPage(suiteName: string): Promise<string> {
  // Reset tracked nodes for this suite
  trackedNodes = []

  // Save original page
  const currentPage = (await run('eval "return {id: figma.currentPage.id}"')) as { id: string }
  originalPageId = currentPage.id

  // Create unique test page for this suite
  const pageName = `__test_${suiteName}_${Date.now()}__`
  const page = (await run(`create page "${pageName}" --json`)) as { id: string }
  testPageId = page.id

  // Switch to test page
  await run(`page set "${testPageId}" --json`)

  return testPageId
}

export async function teardownTestPage(): Promise<void> {
  trackedNodes = []

  // Return to original page first
  if (originalPageId) {
    await run(`page set "${originalPageId}" --json`).catch(() => {})
    originalPageId = null
  }

  // Delete test page (all nodes inside will be deleted with it)
  if (testPageId) {
    await run(`node delete ${testPageId} --json`).catch(() => {})
    testPageId = null
  }
}
