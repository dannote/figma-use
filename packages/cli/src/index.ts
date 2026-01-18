import { defineCommand, runMain } from 'citty'
import * as commands from './commands/index.ts'

const main = defineCommand({
  meta: {
    name: 'figma-use',
    description: 'Control Figma from the command line. Supports JSX rendering with components and variants — see `figma-use render --examples`',
    version: '0.5.0'
  },
  subCommands: commands
})

runMain(main)
