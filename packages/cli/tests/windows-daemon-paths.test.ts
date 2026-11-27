import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { getDaemonPaths } from '../src/daemon/paths.ts'
import { resolveWindowsFigmaBinary } from '../src/format.ts'

describe('daemon paths', () => {
  test('uses Windows named pipe and temp directory on win32', () => {
    const paths = getDaemonPaths('win32', 'C:\\Temp')
    expect(paths.socketPath).toBe('\\\\.\\pipe\\figma-use')
    expect(paths.pidFile).toBe(join('C:\\Temp', 'figma-use.pid'))
    expect(paths.portFile).toBe(join('C:\\Temp', 'figma-use.port'))
    expect(paths.isNamedPipe).toBe(true)
  })

  test('preserves /tmp Unix socket paths on darwin and linux', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const paths = getDaemonPaths(platform, '/var/tmp')
      expect(paths.socketPath).toBe('/tmp/figma-use.sock')
      expect(paths.pidFile).toBe('/tmp/figma-use.pid')
      expect(paths.portFile).toBe('/tmp/figma-use.port')
      expect(paths.isNamedPipe).toBe(false)
    }
  })
})

describe('resolveWindowsFigmaBinary', () => {
  test('selects newest versioned app-* binary over Squirrel stub', () => {
    const root = mkdtempSync(join(tmpdir(), 'figma-win-bin-'))
    try {
      const figmaDir = join(root, 'Figma')
      mkdirSync(join(figmaDir, 'app-126.9.2'), { recursive: true })
      mkdirSync(join(figmaDir, 'app-126.12.8'), { recursive: true })
      mkdirSync(join(figmaDir, 'app-126.11.11'), { recursive: true })
      writeFileSync(join(figmaDir, 'Figma.exe'), '')
      writeFileSync(join(figmaDir, 'app-126.9.2', 'Figma.exe'), '')
      writeFileSync(join(figmaDir, 'app-126.11.11', 'Figma.exe'), '')
      writeFileSync(join(figmaDir, 'app-126.12.8', 'Figma.exe'), '')

      expect(resolveWindowsFigmaBinary(root)).toBe(join(figmaDir, 'app-126.12.8', 'Figma.exe'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('falls back to Squirrel stub when no app-* directory exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'figma-win-stub-'))
    try {
      const figmaDir = join(root, 'Figma')
      mkdirSync(figmaDir, { recursive: true })
      writeFileSync(join(figmaDir, 'Figma.exe'), '')

      expect(resolveWindowsFigmaBinary(root)).toBe(join(figmaDir, 'Figma.exe'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
