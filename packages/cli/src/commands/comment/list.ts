import { defineCommand } from 'citty'

import { getComments, type Comment } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { dim, accent, success } from '../../format.ts'

function formatComment(c: Comment): string {
  const resolved = c.resolved_at ? success(' ✓') : ''
  const node = c.client_meta?.node_id ? dim(` on ${c.client_meta.node_id}`) : ''
  const reply = c.parent_id ? dim(' (reply)') : ''
  const date = new Date(c.created_at).toLocaleDateString()
  return `${accent(c.user.handle)}${reply}${resolved}${node} ${dim(date)}\n  ${c.message}\n  ${dim(`id: ${c.id}`)}`
}

export default defineCommand({
  meta: { description: 'List comments on the current file' },
  args: {
    file: { type: 'string', description: 'File key (default: current file)' },
    node: { type: 'string', description: 'Filter by node ID' },
    unresolved: { type: 'boolean', description: 'Only show unresolved comments' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let comments = await getComments(args.file)

      if (args.node) {
        comments = comments.filter((c) => c.client_meta?.node_id === args.node)
      }
      if (args.unresolved) {
        comments = comments.filter((c) => !c.resolved_at)
      }

      if (args.json) {
        console.log(JSON.stringify(comments, null, 2))
        return
      }

      if (comments.length === 0) {
        console.log('No comments found')
        return
      }

      console.log(comments.map(formatComment).join('\n\n'))
    } catch (e) {
      handleError(e)
    }
  }
})
