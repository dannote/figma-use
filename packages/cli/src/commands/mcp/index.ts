import { defineCommand } from 'citty'
import serve from './serve.ts'

export default defineCommand({
  meta: { description: 'MCP server commands' },
  subCommands: {
    serve
  }
})
