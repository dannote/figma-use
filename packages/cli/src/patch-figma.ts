import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const ASAR_PATHS: Record<string, string> = {
  darwin: '/Applications/Figma.app/Contents/Resources/app.asar',
  win32: `${process.env.LOCALAPPDATA}\\Figma\\resources\\app.asar`
}

const TARGET = Buffer.from('removeSwitch("remote-debugging-port")')
const REPLACEMENT = Buffer.from('removeSwitch("remote-debugXing-port")')

function getAsarPath(): string | null {
  return ASAR_PATHS[process.platform] ?? null
}

export function isFigmaPatched(): boolean | null {
  const path = getAsarPath()
  if (!path) return null

  try {
    const data = readFileSync(path)
    if (data.includes(TARGET)) return false
    if (data.includes(REPLACEMENT)) return true
    return null
  } catch {
    return null
  }
}

export function patchFigma(): boolean {
  const path = getAsarPath()
  if (!path) return false

  const data = readFileSync(path)
  const pos = data.indexOf(TARGET)
  if (pos < 0) return false

  REPLACEMENT.copy(data, pos)
  writeFileSync(path, data)

  if (process.platform === 'darwin') {
    execSync('codesign --force --deep --sign - /Applications/Figma.app', {
      stdio: 'ignore'
    })
  }

  return true
}
