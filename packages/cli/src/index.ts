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
  subCommands: commands
})

process.on('beforeExit', () => closeCDP())

runMain(main)
