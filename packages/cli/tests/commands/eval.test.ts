import { describe, test, expect } from 'bun:test'

import { run, trackNode } from '../helpers.ts'

describe('eval', () => {
  test('executes code and returns result', async () => {
    const result = await run('eval "return 2 + 2" --json')
    expect(result).toBe(4)
  })

  test('accesses figma API', async () => {
    const result = (await run('eval "return figma.currentPage.name" --json')) as string
    expect(typeof result).toBe('string')
  })

  test('creates nodes via eval', async () => {
    const result = (await run(
      'eval "const r = figma.createRectangle(); r.name = \'EvalRect\'; r.resize(50, 50); return {id: r.id, name: r.name}" --json'
    )) as any
    trackNode(result.id)
    expect(result.name).toBe('EvalRect')
  })

  test('runs async code', async () => {
    const result = (await run(
      'eval "const pages = await figma.root.children; return pages.length" --json'
    )) as number
    expect(result).toBeGreaterThan(0)
  })
})

describe('timeout', () => {
  test('short timeout triggers error on slow operation', async () => {
    await expect(
      run('eval "await new Promise(r => setTimeout(r, 2000)); return \'done\'" --timeout 1 --json')
    ).rejects.toThrow('timeout')
  })

  test('long timeout allows slow operation to complete', async () => {
    const result = await run(
      'eval "await new Promise(r => setTimeout(r, 1000)); return \'done\'" --timeout 3 --json'
    )
    expect(result).toBe('done')
  })
})
