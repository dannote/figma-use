import { defineCommand } from 'citty'

import { deleteComment } from '../../cdp-api.ts'
import { handleError } from '../../client.ts'
import { success } from '../../format.ts'

export default defineCommand({
  meta: { description: 'Delete a comment' },
  args: {
    id: { type: 'positional', description: 'Comment ID to delete', required: true },
    file: { type: 'string', description: 'File key (default: current file)' }
  },
  async run({ args }) {
    try {
      await deleteComment(args.id, args.file)
      console.log(success('Comment deleted'))
    } catch (e) {
      handleError(e)
    }
  }
})
