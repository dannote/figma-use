import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a line' },
  args: {
    x: { type: 'string', description: 'X position', required: true },
    y: { type: 'string', description: 'Y position', required: true },
    length: { type: 'string', description: 'Line length', required: true },
    rotation: { type: 'string', description: 'Rotation in degrees', default: '0' },
    name: { type: 'string', description: 'Node name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-line', {
        x: Number(args.x),
        y: Number(args.y),
        length: Number(args.length),
        rotation: Number(args.rotation),
        name: args.name,
        parentId: args.parentId
      }))
    } catch (e) { handleError(e) }
  }
})
