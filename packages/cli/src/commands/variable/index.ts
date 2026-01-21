import { defineCommand } from 'citty'

import bind from './bind.ts'
import create from './create.ts'
import deleteCmd from './delete.ts'
import get from './get.ts'
import list from './list.ts'
import set from './set.ts'

export default defineCommand({
  meta: { description: 'Variable operations' },
  subCommands: {
    list,
    get,
    create,
    set,
    delete: deleteCmd,
    bind
  }
})
