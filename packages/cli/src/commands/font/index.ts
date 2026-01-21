import { defineCommand } from 'citty'

import list from './list.ts'

export default defineCommand({
  meta: { description: 'Font operations' },
  subCommands: {
    list
  }
})
