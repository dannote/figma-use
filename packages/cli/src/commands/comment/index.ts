import { defineCommand } from 'citty'

import add from './add.ts'
import del from './delete.ts'
import list from './list.ts'
import watch from './watch.ts'

export default defineCommand({
  meta: { description: 'Manage file comments ' },
  subCommands: {
    list,
    add,
    delete: del,
    watch
  }
})
