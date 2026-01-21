import { defineCommand } from 'citty'

import { sendCommand, printResult } from '../client.ts'

export default defineCommand({
  meta: { description: 'Execute JavaScript in Figma plugin context' },
  args: {
    code: { type: 'positional', description: 'JavaScript code', required: true },
    timeout: { type: 'string', description: 'Timeout in seconds' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const result = await sendCommand(
      'eval',
      { code: args.code },
      {
        timeout: args.timeout ? Number(args.timeout) * 1000 : undefined
      }
    )
    printResult(result, args.json)
  }
})
