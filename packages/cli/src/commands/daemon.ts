import { spawn } from 'child_process'
import { defineCommand } from 'citty'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { startDaemon, stopDaemon, isDaemonRunning, getDaemonInfo } from '../daemon/index.ts'
import { ok, fail } from '../format.ts'

export default defineCommand({
  meta: { name: 'daemon', description: 'Manage figma-use daemon for faster command execution' },
  subCommands: {
    start: defineCommand({
      meta: { description: 'Start daemon in background' },
      args: {
        foreground: {
          type: 'boolean',
          alias: 'f',
          description: "Run in foreground (don't daemonize)"
        },
        pipe: {
          type: 'boolean',
          description:
            'Launch Figma with --remote-debugging-pipe instead of connecting to port 9222. ' +
            'No patching required — works on Figma 126.1.2+ without admin access.'
        }
      },
      async run({ args }) {
        if (isDaemonRunning()) {
          const info = getDaemonInfo()
          console.log(`Daemon already running (PID ${info?.pid})`)
          return
        }

        if (args.foreground) {
          startDaemon({ pipe: args.pipe })
        } else {
          const currentFile = fileURLToPath(import.meta.url)
          const cliDir = dirname(currentFile)
          const indexPath = cliDir.includes('dist/cli')
            ? join(cliDir, '../cli/index.js')
            : join(cliDir, '../index.ts')

          const daemonArgs = [indexPath, 'daemon', 'start', '-f']
          if (args.pipe) daemonArgs.push('--pipe')

          const child = spawn(process.execPath, daemonArgs, {
            detached: true,
            stdio: 'ignore'
          })
          child.unref()

          // Pipe mode needs more time to launch Figma
          const waitTime = args.pipe ? 5000 : 500
          await new Promise((r) => setTimeout(r, waitTime))

          if (isDaemonRunning()) {
            const info = getDaemonInfo()
            console.log(ok(`Daemon started (PID ${info?.pid})`))
            if (args.pipe) console.log('  Figma launched with debug pipe')
          } else {
            console.error(fail('Failed to start daemon'))
            process.exit(1)
          }
        }
      }
    }),

    stop: defineCommand({
      meta: { description: 'Stop daemon' },
      async run() {
        if (stopDaemon()) {
          console.log(ok('Daemon stopped'))
        } else {
          console.log('Daemon not running')
        }
      }
    }),

    status: defineCommand({
      meta: { description: 'Check daemon status' },
      async run() {
        const info = getDaemonInfo()
        if (info) {
          console.log(ok(`Daemon running (PID ${info.pid})`))
          console.log(`  Socket: ${info.socket}`)
        } else {
          console.log('Daemon not running')
        }
      }
    }),

    restart: defineCommand({
      meta: { description: 'Restart daemon' },
      args: {
        pipe: {
          type: 'boolean',
          description: 'Launch Figma with --remote-debugging-pipe'
        }
      },
      async run({ args }) {
        stopDaemon()
        await new Promise((r) => setTimeout(r, 100))

        const currentFile = fileURLToPath(import.meta.url)
        const cliDir = dirname(currentFile)
        const indexPath = cliDir.includes('dist/cli')
          ? join(cliDir, '../cli/index.js')
          : join(cliDir, '../index.ts')

        const daemonArgs = [indexPath, 'daemon', 'start', '-f']
        if (args.pipe) daemonArgs.push('--pipe')

        const child = spawn(process.execPath, daemonArgs, {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()

        const waitTime = args.pipe ? 5000 : 500
        await new Promise((r) => setTimeout(r, waitTime))

        if (isDaemonRunning()) {
          const info = getDaemonInfo()
          console.log(ok(`Daemon restarted (PID ${info?.pid})`))
        } else {
          console.error(fail('Failed to restart daemon'))
          process.exit(1)
        }
      }
    })
  }
})
