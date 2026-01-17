import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create a text node' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    text: { type: 'string', description: 'Text content', required: true },
    fontSize: { type: 'string', description: 'Font size' },
    fontName: { type: 'string', description: 'Font name' },
    fontWeight: { type: 'string', description: 'Font weight' },
    fontColor: { type: 'string', description: 'Font color (hex, e.g. #000000FF)' },
    name: { type: 'string', description: 'Node name' },
    parentId: { type: 'string', description: 'Parent node ID' }
  },
  async run({ args }) {
    try {
      printResult(
        await sendCommand('create-text', {
          x: Number(args.x),
          y: Number(args.y),
          text: args.text,
          fontSize: args.fontSize ? Number(args.fontSize) : undefined,
          fontName: args.fontName,
          fontWeight: args.fontWeight ? Number(args.fontWeight) : undefined,
          fontColor: args.fontColor,
          name: args.name,
          parentId: args.parentId
        })
      )
    } catch (e) {
      handleError(e)
    }
  }
})
