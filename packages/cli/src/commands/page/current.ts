import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Get current page' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const result = await sendCommand<{ id: string; name: string }>('eval', {
        code: 'return { id: figma.currentPage.id, name: figma.currentPage.name }'
      })
      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`${result.name} (${result.id})`)
      }
    } catch (e) {
      handleError(e)
    }
  }
})
