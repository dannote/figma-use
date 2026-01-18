import { defineCommand } from 'citty'
import { printResult } from '../output.ts'

export default defineCommand({
  meta: { description: 'Show MCP server configuration' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const config = {
      mcpServers: {
        "figma-use": {
          url: "http://localhost:38451/mcp"
        }
      }
    }

    printResult(config, args.json)
  }
})
