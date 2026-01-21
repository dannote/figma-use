import { defineCommand } from 'citty'

import create from './create.ts'
import flatten from './flatten.ts'
import ungroup from './ungroup.ts'

export default defineCommand({
  meta: { description: 'Group operations' },
  subCommands: {
    create,
    ungroup,
    flatten
  }
})
