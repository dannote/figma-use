import { defineCommand } from 'citty'
import { sendCommand } from '../../client.ts'
import { printResult } from '../../output.ts'

export default defineCommand({
  meta: {
    name: 'query',
    description: `Query nodes using XPath selectors

Examples:
  figma-use query "//FRAME"                              # All frames
  figma-use query "//FRAME[@width < 300]"                # Frames narrower than 300px
  figma-use query "//COMPONENT[starts-with(@name, 'Button')]"  # Components starting with Button
  figma-use query "//FRAME[contains(@name, 'Card')]"     # Frames with 'Card' in name
  figma-use query "//SECTION/FRAME"                      # Direct frame children of sections
  figma-use query "//SECTION//TEXT"                      # All text nodes inside sections
  figma-use query "//*[@cornerRadius > 0]"               # Any node with corner radius`,
  },
  args: {
    selector: {
      type: 'positional',
      description:
        'XPath selector (e.g., //FRAME[@width < 300], //TEXT[contains(@name, "Label")])',
      required: true,
    },
    root: {
      type: 'string',
      description: 'Root node ID (default: current page)',
    },
    select: {
      type: 'string',
      description: 'Comma-separated fields to return (default: id,name,type)',
    },
    limit: {
      type: 'string',
      description: 'Max results to return (default: 1000)',
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
    },
  },
  async run({ args }) {
    const select = args.select?.split(',').map(s => s.trim())
    const limit = args.limit ? parseInt(args.limit, 10) : undefined

    const result = await sendCommand('query', {
      selector: args.selector,
      rootId: args.root,
      select,
      limit,
    })

    if (args.json) {
      printResult(result, true)
    } else if (Array.isArray(result)) {
      if (result.length === 0) {
        console.log('No nodes found')
      } else {
        for (const node of result) {
          const parts = []
          if (node.type) parts.push(`[${node.type}]`)
          if (node.name) parts.push(`"${node.name}"`)
          if (node.id) parts.push(`(${node.id})`)
          if (node.width !== undefined && node.height !== undefined) {
            parts.push(`${node.width}×${node.height}`)
          }
          console.log(parts.join(' '))
        }
        console.log(`\n${result.length} node(s) found`)
      }
    } else {
      printResult(result, false)
    }
  },
})
