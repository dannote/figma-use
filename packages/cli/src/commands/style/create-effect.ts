import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Create an effect style' },
  args: {
    name: { type: 'positional', description: 'Style name', required: true },
    type: {
      type: 'string',
      description: 'Effect type: DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR',
      required: true
    },
    radius: { type: 'string', description: 'Blur radius' },
    'offset-x': { type: 'string', description: 'Shadow offset X' },
    'offset-y': { type: 'string', description: 'Shadow offset Y' },
    color: { type: 'string', description: 'Shadow color (hex with alpha)' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand('create-effect-style', {
        name: args.name,
        type: args.type,
        radius: args.radius ? Number(args.radius) : undefined,
        offsetX: args["offset-x"] ? Number(args["offset-x"]) : undefined,
        offsetY: args["offset-y"] ? Number(args["offset-y"]) : undefined,
        color: args.color
      })
      printResult(result, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
