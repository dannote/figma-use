import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a component' },
  args: {
    name: { type: 'string', description: 'Component name', required: true },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('create-component', {
          name: args.name,
          parentId: args.parentId
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
