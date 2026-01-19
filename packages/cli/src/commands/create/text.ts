import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create a text node' },
  args: {
    x: { type: 'string', description: 'X coordinate', required: true },
    y: { type: 'string', description: 'Y coordinate', required: true },
    text: { type: 'string', description: 'Text content', required: true },
    'font-size': { type: 'string', description: 'Font size' },
    'font-family': { type: 'string', description: 'Font family (default: Inter)' },
    'font-style': { type: 'string', description: 'Font style (Regular, Bold, Medium, etc)' },
    fill: { type: 'string', description: 'Text color (hex)' },
    opacity: { type: 'string', description: 'Opacity (0-1)' },
    name: { type: 'string', description: 'Node name' },
    parent: { type: 'string', description: 'Parent node ID' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-text', {
        x: Number(args.x),
        y: Number(args.y),
        text: args.text,
        fontSize: args["font-size"] ? Number(args["font-size"]) : undefined,
        fontFamily: args["font-family"],
        fontStyle: args["font-style"],
        fill: args.fill,
        opacity: args.opacity ? Number(args.opacity) : undefined,
        name: args.name,
        parentId: args.parent
      })
      printResult(result, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
