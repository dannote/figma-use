import { defineCommand, runMain } from 'citty'
import * as commands from './commands/index.ts'

const main = defineCommand({
  meta: {
    name: 'figma',
    description: 'CLI to interact with Figma via proxy',
    version: '0.1.0'
  },
  subCommands: commands
})

runMain(main)
