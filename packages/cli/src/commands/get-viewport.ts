import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get current viewport position and zoom' },
  async run() {
    try {
      printResult(await sendCommand('get-viewport'))
    } catch (e) { handleError(e) }
  }
})
