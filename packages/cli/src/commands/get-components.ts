import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get all components' },
  async run() {
    try {
      printResult(await sendCommand('get-all-components'))
    } catch (e) {
      handleError(e)
    }
  }
})
