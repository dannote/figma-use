import { defineCommand } from 'citty'

import get from './get.ts'
import set from './set.ts'

export default defineCommand({
  meta: { description: 'Selection operations' },
  subCommands: {
    get,
    set
  }
})
