import { defineCommand } from 'citty'
import list from './list.ts'
import add from './add.ts'
import del from './delete.ts'

export default defineCommand({
  meta: { description: 'Manage file comments (REST API)' },
  subCommands: {
    list,
    add,
    delete: del
  }
})
