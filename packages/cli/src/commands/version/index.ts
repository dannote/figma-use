import { defineCommand } from 'citty'
import list from './list.ts'

export default defineCommand({
  meta: { description: 'View file version history (REST API)' },
  subCommands: {
    list
  }
})
