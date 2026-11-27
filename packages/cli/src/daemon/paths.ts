import { tmpdir } from 'os'
import { join } from 'path'

export interface DaemonPaths {
  socketPath: string
  pidFile: string
  portFile: string
  isNamedPipe: boolean
}

export function getDaemonPaths(
  platform: NodeJS.Platform = process.platform,
  tempDir: string = tmpdir()
): DaemonPaths {
  if (platform === 'win32') {
    return {
      socketPath: '\\\\.\\pipe\\figma-use',
      pidFile: join(tempDir, 'figma-use.pid'),
      portFile: join(tempDir, 'figma-use.port'),
      isNamedPipe: true
    }
  }

  return {
    socketPath: '/tmp/figma-use.sock',
    pidFile: '/tmp/figma-use.pid',
    portFile: '/tmp/figma-use.port',
    isNamedPipe: false
  }
}
