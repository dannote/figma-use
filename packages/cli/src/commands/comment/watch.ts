import { defineCommand } from 'citty'

import { getComments, type Comment } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { dim, accent } from '../../format.ts'

function formatComment(c: Comment): string {
  const node = c.client_meta?.node_id ? dim(` on ${c.client_meta.node_id}`) : ''
  const reply = c.parent_id ? dim(' (reply)') : ''
  const date = new Date(c.created_at).toLocaleDateString()
  return `${accent(c.user.handle)}${reply}${node} ${dim(date)}\n  ${c.message}\n  ${dim(`id: ${c.id}`)}`
}

export default defineCommand({
  meta: { description: 'Wait for a new comment and return its content' },
  args: {
    file: { type: 'string', description: 'File key (default: current file)' },
    interval: { type: 'string', description: 'Poll interval in seconds', default: '3' },
    timeout: { type: 'string', description: 'Timeout in seconds (0 = no timeout)', default: '0' },
    'include-resolved': { type: 'boolean', description: 'Include resolved comments' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const interval = Math.max(1, parseInt(args.interval, 10)) * 1000
      const timeout = parseInt(args.timeout, 10) * 1000
      const startTime = Date.now()

      // Get initial comments to establish baseline
      const initialComments = await getComments(args.file)
      const seenIds = new Set(initialComments.map((c) => c.id))

      if (!args.json) {
        process.stderr.write(`Watching for comments (poll: ${interval / 1000}s)...\n`)
      }

      while (true) {
        // Check timeout
        if (timeout > 0 && Date.now() - startTime > timeout) {
          if (args.json) {
            console.log(JSON.stringify({ timeout: true }))
          } else {
            console.log('Timeout reached')
          }
          return
        }

        await new Promise((r) => setTimeout(r, interval))

        const comments = await getComments(args.file)
        const newComments = comments.filter((c) => {
          if (seenIds.has(c.id)) return false
          if (!args['include-resolved'] && c.resolved_at) return false
          return true
        })

        if (newComments.length > 0) {
          const comment = newComments[0]!

          if (args.json) {
            console.log(JSON.stringify(comment, null, 2))
          } else {
            console.log(formatComment(comment))
          }

          return
        }
      }
    } catch (e) {
      handleError(e)
    }
  }
})
