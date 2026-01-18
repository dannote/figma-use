import { defineCommand } from 'citty'
import info from './info.ts'

export default defineCommand({
  meta: { description: 'File operations (REST API)' },
  subCommands: {
    info
  }
})
