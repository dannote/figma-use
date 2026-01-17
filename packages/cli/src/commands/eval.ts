import { defineCommand } from 'citty'
import { sendCommand } from '../client.ts'
import { printResult } from '../output.ts'

export default defineCommand({
  meta: { description: 'Execute arbitrary code in Figma plugin context' },
  args: {
    code: { type: 'positional', description: 'JavaScript code to execute', required: true },
    json: { type: 'boolean', description: 'Output raw JSON' },
    timeout: { type: 'string', description: 'Timeout in seconds' }
  },
  async run({ args }) {
    const result = await sendCommand('eval', { code: args.code }, { 
      timeout: args.timeout ? Number(args.timeout) * 1000 : undefined 
    })
    printResult(result, args.json)
  }
})
