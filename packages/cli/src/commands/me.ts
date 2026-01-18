import { defineCommand } from 'citty'
import { getCurrentUser } from '../cdp-api.ts'
import { handleError } from '../client.ts'
import { accent } from '../format.ts'

export default defineCommand({
  meta: { description: 'Get current user info' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const user = await getCurrentUser()
      
      if (args.json) {
        console.log(JSON.stringify(user, null, 2))
        return
      }
      
      console.log(`${accent(user.handle || user.name)}`)
      console.log(`  ID: ${user.id}`)
      if (user.email) console.log(`  Email: ${user.email}`)
    } catch (e) { handleError(e) }
  }
})
