import { defineCommand, runMain } from 'citty'

import { version } from '../../../package.json'
import { closeCDP, setCdpPortOverride } from './cdp.ts'
import * as commands from './commands/index.ts'

function normalizeGlobalPortArg(): void {
  const args = process.argv.slice(2)
  const portIndex = args.findIndex((arg) => arg === '--port' || arg.startsWith('--port='))
  if (portIndex === -1) return

  const firstCommandIndex = args.findIndex((arg) => !arg.startsWith('-'))
  if (firstCommandIndex !== -1 && portIndex > firstCommandIndex) return

  const raw = args[portIndex]!
  const value = raw === '--port' ? args[portIndex + 1] : raw.slice('--port='.length)
  if (value === undefined) return

  setCdpPortOverride(value)
  const deleteCount = raw === '--port' ? 2 : 1
  process.argv.splice(portIndex + 2, deleteCount)
}

const main = defineCommand({
  meta: {
    name: 'figma-use',
    description:
      'Control Figma from the command line. Supports JSX rendering with components and variants — see `figma-use render --examples`',
    version
  },
  args: {
    port: {
      type: 'string',
      description: 'Chrome DevTools port Figma is listening on (default 9222, or FIGMA_PORT env)'
    }
  },
  subCommands: commands
})

process.on('beforeExit', () => closeCDP())

normalizeGlobalPortArg()
runMain(main)
