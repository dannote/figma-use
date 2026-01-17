import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Set component property references of a node' },
  args: {
    id: { type: 'string', description: 'Node ID', required: true },
    refs: { type: 'string', description: 'References JSON (e.g. {"characters": "propName"})', required: true }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('set-node-component-property-references', {
          id: args.id,
          componentPropertyReferences: JSON.parse(args.refs)
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
