import { defineCommand } from 'citty'

import create from './create.ts'
import deleteCmd from './delete.ts'
import get from './get.ts'
import list from './list.ts'

export default defineCommand({
  meta: { description: 'Variable collection operations' },
  subCommands: {
    list,
    get,
    create,
    delete: deleteCmd
  }
})
