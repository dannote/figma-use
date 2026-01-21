import { defineCommand } from 'citty'

import current from './current.ts'
import list from './list.ts'
import set from './set.ts'

export default defineCommand({
  meta: { description: 'Page operations' },
  subCommands: {
    current,
    list,
    set
  }
})
