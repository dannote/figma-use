import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Create an effect style' },
  args: {
    name: { type: 'string', description: 'Style name', required: true },
    type: { type: 'string', description: 'Effect type: DROP_SHADOW, INNER_SHADOW, BLUR, BACKGROUND_BLUR', required: true },
    radius: { type: 'string', description: 'Blur radius', default: '10' },
    color: { type: 'string', description: 'Shadow color (hex)', default: '#00000040' },
    offsetX: { type: 'string', description: 'Shadow X offset', default: '0' },
    offsetY: { type: 'string', description: 'Shadow Y offset', default: '4' }
  },
  async run({ args }) {
    try {
      printResult(await sendCommand('create-effect-style', {
        name: args.name,
        type: args.type,
        radius: Number(args.radius),
        color: args.color,
        offsetX: Number(args.offsetX),
        offsetY: Number(args.offsetY)
      }))
    } catch (e) { handleError(e) }
  }
})
