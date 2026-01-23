import { defineCommand } from 'citty'
import { sendCommand } from '../../client.ts'

export default defineCommand({
  meta: { description: 'Generate accessibility tree snapshot of the design' },
  args: {
    id: { type: 'string', description: 'Node ID (default: selection or page)' },
    interactive: { type: 'boolean', alias: 'i', description: 'Show only interactive elements' },
    depth: { type: 'string', alias: 'd', description: 'Max depth to traverse' },
    'no-compact': { type: 'boolean', description: 'Disable tree simplification (show all wrappers)' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const result = await sendCommand('snapshot', {
      id: args.id,
      interactive: args.interactive,
      maxDepth: args.depth ? Number(args.depth) : undefined,
      compact: !args['no-compact'],
    }) as { tree: string; refs: Record<string, unknown>; refCount: number }

    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    console.log(result.tree)

    if (result.refCount > 0) {
      console.log()
      console.log(`${result.refCount} interactive elements with refs`)
    }
  },
})
