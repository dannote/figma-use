import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('export', () => {
  let nodeId: string

  beforeAll(async () => {
    await setupTestPage('export')
    const rect = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --fill "#FF0000" --json'
    )) as any
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    await teardownTestPage()
    // Cleanup export files
    for (const f of ['/tmp/test-export.png', '/tmp/test-export.svg']) {
      if (existsSync(f)) unlinkSync(f)
    }
  })

  test('node exports to PNG', async () => {
    const output = (await run(
      `export node ${nodeId} --output /tmp/test-export.png`,
      false
    )) as string
    expect(output).toContain('/tmp/test-export.png')
    expect(existsSync('/tmp/test-export.png')).toBe(true)
  })

  test('node exports to SVG', async () => {
    const output = (await run(
      `export node ${nodeId} --output /tmp/test-export.svg --format svg`,
      false
    )) as string
    expect(output).toContain('/tmp/test-export.svg')
    expect(existsSync('/tmp/test-export.svg')).toBe(true)
  })
})

describe('export jsx', () => {
  let frameId: string

  beforeAll(async () => {
    await setupTestPage('export-jsx')
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('exports frame as JSX', async () => {
    const frame = (await run(
      'create frame --x 0 --y 0 --width 200 --height 100 --fill "#3B82F6" --json'
    )) as any
    frameId = frame.id
    trackNode(frameId)

    const jsx = (await run(`export jsx ${frameId}`, false)) as string
    expect(jsx).toContain('import { Frame }')
    expect(jsx).toContain('export default function')
    expect(jsx).toContain('w={200}')
    expect(jsx).toContain('h={100}')
    expect(jsx).toContain('bg="#3B82F6"')
  })

  test('exports frame with text child', async () => {
    const frame = (await run(
      'create frame --x 300 --y 0 --width 150 --height 50 --fill "#10B981" --json'
    )) as any
    trackNode(frame.id)

    const text = (await run(
      `create text --x 0 --y 0 --parent ${frame.id} --text "Hello" --size 16 --color "#FFFFFF" --json`
    )) as any
    trackNode(text.id)

    const jsx = (await run(`export jsx ${frame.id}`, false)) as string
    expect(jsx).toContain('import { Frame, Text }')
    expect(jsx).toContain('<Text')
    expect(jsx).toContain('Hello')
    expect(jsx).toContain('</Text>')
  })

  test('round-trip: export jsx then render produces same structure', async () => {
    // Create original
    const original = (await run(
      'create frame --x 600 --y 0 --width 120 --height 60 --fill "#EF4444" --radius 8 --json'
    )) as any
    trackNode(original.id)

    // Export to JSX
    const jsx = (await run(`export jsx ${original.id}`, false)) as string
    expect(jsx).toContain('rounded={8}')

    // Render JSX back (via shell pipe)
    const rendered = JSON.parse(
      execSync(
        `cd ${process.cwd()} && echo '${jsx.replace(/'/g, "'\\''")}' | node bin/figma-use.js render --stdin --x 800 --y 0 --json`,
        { encoding: 'utf-8' }
      )
    )
    trackNode(rendered.id)

    // Compare properties
    const originalNode = (await run(`node get ${original.id} --json`)) as any
    const renderedNode = (await run(`node get ${rendered.id} --json`)) as any

    expect(renderedNode.width).toBe(originalNode.width)
    expect(renderedNode.height).toBe(originalNode.height)
    expect(renderedNode.cornerRadius).toBe(originalNode.cornerRadius)
    expect(renderedNode.fills[0].color).toBe(originalNode.fills[0].color)
  })

  test('exports icon with Iconify pattern as Icon element', async () => {
    // Render an icon first
    const icon = JSON.parse(
      execSync(
        `cd ${process.cwd()} && echo '<Icon name="lucide:star" size={24} color="#F59E0B" />' | node bin/figma-use.js render --stdin --x 1000 --y 0 --json`,
        { encoding: 'utf-8' }
      )
    )
    trackNode(icon.id)

    // Export should recognize Iconify pattern
    const jsx = (await run(`export jsx ${icon.id}`, false)) as string
    expect(jsx).toContain('import { Icon }')
    expect(jsx).toContain('name="lucide:star"')
    expect(jsx).toContain('size={24}')
  })
})
