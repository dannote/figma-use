import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Set instance component properties' },
  args: {
    id: { type: 'positional', description: 'Instance ID', required: true },
    prop: {
      type: 'string',
      description: 'Property in format name=value (can be repeated)',
      required: true
    },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      // Parse properties from repeated --prop arguments or comma-separated
      const propArg = args.prop as string | string[]
      const propStrings = Array.isArray(propArg) ? propArg : [propArg]

      const properties: Record<string, string | boolean> = {}
      for (const p of propStrings) {
        const parts = p.split('=')
        const name = parts[0]
        if (!name) continue
        const value = parts.slice(1).join('=')
        if (value === 'true') properties[name] = true
        else if (value === 'false') properties[name] = false
        else properties[name] = value
      }

      const result = await sendCommand('set-instance-properties', {
        instanceId: args.id,
        properties
      })
      printResult(result, args.json, 'update')
    } catch (e) {
      handleError(e)
    }
  }
})
