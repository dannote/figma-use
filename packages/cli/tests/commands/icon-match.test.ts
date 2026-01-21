import { describe, expect, test, beforeAll, afterAll } from 'bun:test'

import { run, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('icon matching', () => {
  beforeAll(async () => {
    await setupTestPage('icon-match')
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('export jsx without --match-icons exports inline SVG', async () => {
    // Create a simple checkmark vector
    const frame = (await run('create frame --x 0 --y 0 --width 100 --height 100 --name IconTest --json')) as { id: string }

    // Create a vector that looks like a checkmark
    await run(`create vector --parent ${frame.id} --x 0 --y 0 --name check-vector --path "M 4 12 L 9 17 L 20 6" --stroke "#000000" --stroke-weight 2 --json`)

    // Export without icon matching - should get inline SVG
    const jsxWithoutMatch = (await run(`export jsx ${frame.id}`, false)) as string

    // Should contain svg element, not Icon
    expect(jsxWithoutMatch).toContain('<svg')
    expect(jsxWithoutMatch).not.toContain('<Icon')
  })

  test('export jsx preserves explicit iconify names without matching', async () => {
    const frame = (await run('create frame --x 0 --y 0 --width 100 --height 100 --name IconifyTest --json')) as { id: string }

    // Create a vector with iconify-style name - should be preserved as-is
    await run(`create vector --parent ${frame.id} --x 0 --y 0 --name "lucide:check" --path "M 4 12 L 9 17 L 20 6" --stroke "#10B981" --stroke-weight 2 --json`)

    const jsx = (await run(`export jsx ${frame.id}`, false)) as string

    // Should use Icon component with the explicit name
    expect(jsx).toContain('<Icon')
    expect(jsx).toContain('name="lucide:check"')
  })
})
