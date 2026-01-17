import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create an instance of a component' },
  args: {
    componentId: { type: 'string', description: 'Component ID', required: true },
    x: { type: 'string', description: 'X coordinate' },
    y: { type: 'string', description: 'Y coordinate' },
    name: { type: 'string', description: 'Instance name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('create-instance', {
          componentId: args.componentId,
          x: args.x ? Number(args.x) : undefined,
          y: args.y ? Number(args.y) : undefined,
          name: args.name,
          parentId: args.parentId
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
