import { defineCommand } from 'citty'
import { getMe } from '../rest-api.ts'
import { getCurrentUser } from '../cdp-api.ts'
import { handleError } from '../client.ts'
import { accent, dim } from '../format.ts'

export default defineCommand({
  meta: { description: 'Get current user info' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let user: { id: string; handle?: string; name?: string; email?: string }
      let source: string
      
      // Try REST API first if token is set
      if (process.env.FIGMA_ACCESS_TOKEN) {
        user = await getMe()
        source = 'REST API'
      } else {
        // Fall back to CDP (extracts from browser)
        user = await getCurrentUser()
        source = 'browser'
      }
      
      if (args.json) {
        console.log(JSON.stringify(user, null, 2))
        return
      }
      
      const name = user.handle || user.name || 'Unknown'
      console.log(`${accent(name)} ${dim(`(${source})`)}`)
      console.log(`  ID: ${user.id}`)
      if (user.email) console.log(`  Email: ${user.email}`)
    } catch (e) { handleError(e) }
  }
})
