import { defineCommand } from 'citty'

import { getVersions } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { dim, accent } from '../../format.ts'

export default defineCommand({
  meta: { description: 'List file version history' },
  args: {
    file: { type: 'string', description: 'File key (default: current file)' },
    limit: { type: 'string', description: 'Max versions to show', default: '20' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const versions = await getVersions(args.file, Number(args.limit))

      if (args.json) {
        console.log(JSON.stringify(versions, null, 2))
        return
      }

      if (versions.length === 0) {
        console.log('No versions found')
        return
      }

      for (const v of versions) {
        const date = new Date(v.created_at).toLocaleString()
        const label = v.label ? accent(v.label) : dim('(auto-save)')
        console.log(`${label} ${dim(date)} by ${v.user.handle}`)
        if (v.description) console.log(`  ${v.description}`)
        console.log(`  ${dim(`id: ${v.id}`)}\n`)
      }
    } catch (e) {
      handleError(e)
    }
  }
})
