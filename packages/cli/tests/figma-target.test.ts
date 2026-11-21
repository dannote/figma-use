import { describe, expect, test } from 'bun:test'

import { chooseFileTarget, fileTargets, type FileTargetState } from '../src/figma-target.ts'

const page = (url: string) => ({ type: 'page', url })

const cold: FileTargetState = { loaded: false, visible: false }
const shown: FileTargetState = { loaded: true, visible: true }
const background: FileTargetState = { loaded: true, visible: false }

describe('figma file targets', () => {
  test('skips desktop shell, new-tab, and preload pages', () => {
    expect(
      fileTargets([
        page('https://www.figma.com/preload/desktop-proto'),
        page('https://www.figma.com/desktop_new_tab?fuid=1'),
        page('file:///Applications/Figma.app/Contents/Resources/app.asar/shell.html'),
        { type: 'worker', url: 'https://www.figma.com/design/d/Design' }
      ])
    ).toEqual([])
  })

  test('orders design tabs, then legacy file URLs, then FigJam boards', () => {
    const board = page('https://www.figma.com/board/b/Board')
    const file = page('https://www.figma.com/file/f/File')
    const design = page('https://www.figma.com/design/d/Design')
    expect(fileTargets([board, file, design])).toEqual([design, file, board])
  })
})

describe('choosing a file tab', () => {
  const a = page('https://www.figma.com/design/a/A')
  const b = page('https://www.figma.com/design/b/B')
  const c = page('https://www.figma.com/design/c/C')
  const noSleep = async () => {}

  test('picks the shown tab over cold and background tabs listed first', async () => {
    const states = new Map([
      [a, cold],
      [b, background],
      [c, shown]
    ])
    const target = await chooseFileTarget({
      listTargets: async () => [a, b, c],
      probe: async (t) => states.get(t) ?? null,
      sleep: noSleep
    })
    expect(target).toBe(c)
  })

  test('falls back to a loaded background tab when none is shown', async () => {
    const states = new Map([
      [a, cold],
      [b, background]
    ])
    const target = await chooseFileTarget({
      listTargets: async () => [a, b],
      probe: async (t) => states.get(t) ?? null,
      sleep: noSleep
    })
    expect(target).toBe(b)
  })

  test('waits for the shown tab to finish loading', async () => {
    let round = 0
    const loading: FileTargetState = { loaded: false, visible: true }
    const target = await chooseFileTarget({
      listTargets: async () => {
        round++
        return [a, b]
      },
      probe: async (t) => (t === b ? (round >= 3 ? shown : loading) : cold),
      sleep: noSleep
    })
    expect(target).toBe(b)
    expect(round).toBe(3)
  })

  test('takes the first cold tab at once when no file tab is shown', async () => {
    let rounds = 0
    const target = await chooseFileTarget({
      listTargets: async () => {
        rounds++
        return [a, b]
      },
      probe: async () => cold,
      sleep: noSleep
    })
    expect(target).toBe(a)
    expect(rounds).toBe(1)
  })

  test('stops waiting on a shown tab that never loads', async () => {
    const target = await chooseFileTarget({
      listTargets: async () => [a, b],
      probe: async (t) => (t === b ? { loaded: false, visible: true } : cold),
      timeoutMs: 30,
      intervalMs: 10,
      sleep: noSleep
    })
    expect(target).toBe(a)
  })

  test('waits for file tabs to appear when asked to', async () => {
    let round = 0
    const target = await chooseFileTarget({
      listTargets: async () =>
        ++round < 3 ? [page('https://www.figma.com/preload/desktop-proto')] : [a],
      probe: async () => shown,
      waitForFileTabs: true,
      sleep: noSleep
    })
    expect(target).toBe(a)
  })

  test('returns nothing at once when no file is open and waiting is off', async () => {
    let rounds = 0
    const target = await chooseFileTarget({
      listTargets: async () => {
        rounds++
        return [page('https://www.figma.com/files/feed')]
      },
      probe: async () => shown,
      sleep: noSleep
    })
    expect(target).toBeUndefined()
    expect(rounds).toBe(1)
  })
})
