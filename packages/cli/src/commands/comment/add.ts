import { defineCommand } from 'citty'

import { postComment } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: { description: 'Add a comment to the file' },
  args: {
    message: { type: 'positional', description: 'Comment message', required: true },
    file: { type: 'string', description: 'File key (default: current file)' },
    node: { type: 'string', description: 'Attach comment to node ID' },
    x: { type: 'string', description: 'X position (default: 100)' },
    y: { type: 'string', description: 'Y position (default: 100)' },
    reply: { type: 'string', description: 'Reply to comment ID' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const comment = await postComment(args.message, {
        fileKey: args.file,
        nodeId: args.node,
        x: args.x ? Number(args.x) : undefined,
        y: args.y ? Number(args.y) : undefined,
        replyTo: args.reply
      })
      printResult(comment, args.json)
    } catch (e) {
      handleError(e)
    }
  }
})
