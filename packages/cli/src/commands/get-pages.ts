import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../client.ts'

export default defineCommand({
  meta: { description: 'Get all pages' },
  async run() {
    try {
      printResult(await sendCommand('get-pages'))
    } catch (e) {
      handleError(e)
    }
  }
})
