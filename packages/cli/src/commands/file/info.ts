import { defineCommand } from 'citty'
import { getFileInfoViaBrowser } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { accent } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Get file metadata' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const info = await getFileInfoViaBrowser()
      
      if (args.json) {
        console.log(JSON.stringify(info, null, 2))
        return
      }
      
      console.log(`${accent(info.name)}`)
      console.log(`  Key: ${info.key}`)
    } catch (e) { handleError(e) }
  }
})
