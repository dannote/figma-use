import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get current selection' },
  async run() {
    try {
      printResult(await sendCommand('get-selection'))
    } catch (e) {
      handleError(e)
    }
  }
})
