import { defineCommand, runMain } from 'citty'
import * as commands from './commands/index.ts'
import { version } from '../../../package.json'

const main = defineCommand({
  meta: {
    name: 'figma-use',
    description: 'Control Figma from the command line. Supports JSX rendering with components and variants — see `figma-use render --examples`',
    version
  },
  subCommands: commands
})

runMain(main)
