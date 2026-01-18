import { defineCommand } from 'citty'
import list from './list.ts'
import files from './files.ts'

export default defineCommand({
  meta: { description: 'Manage projects (REST API)' },
  subCommands: {
    list,
    files
  }
})
