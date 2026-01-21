import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('export guards', () => {
  let nodeId: string

  beforeAll(async () => {
    await setupTestPage('guards')
    const rect = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --name "GuardTest" --json'
    )) as { id: string }
    nodeId = rect.id
    trackNode(nodeId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  test('export node blocks oversized export', async () => {
    try {
      await run(`export node ${nodeId} --scale 100`, false)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.message).toContain('exceeds max dimension')
      expect(e.message).toContain('--force')
    }
  })

  test('export node allows with --force', async () => {
    const output = (await run(
      `export node ${nodeId} --scale 2 --output /tmp/guard-test.png`,
      false
    )) as string
    expect(output).toContain('/tmp/guard-test.png')
  })
})

describe('tree guards', () => {
  let frameId: string

  beforeAll(async () => {
    const frame = (await run(
      'create frame --x 0 --y 200 --width 100 --height 100 --name "TreeTest" --json'
    )) as { id: string }
    frameId = frame.id
    trackNode(frameId)
    await run(`create rect --parent ${frameId} --x 0 --y 0 --width 50 --height 50 --json`)
  })

  test('tree shows node count', async () => {
    const output = (await run(`node tree ${frameId}`, false)) as string
    expect(output).toMatch(/\d+ nodes/)
    expect(output).toContain('TreeTest')
  })
})
