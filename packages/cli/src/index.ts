import { defineCommand, runMain } from 'citty'

import { version } from '../../../package.json'
import { closeCDP } from './cdp.ts'
import * as commands from './commands/index.ts'

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

runMain(main)
