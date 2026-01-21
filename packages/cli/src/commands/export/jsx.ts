import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { matchIconsInTree } from '../../icon-matcher.ts'
import {
  enrichWithSvgData,
  formatCode,
  generateCode,
  toComponentName
} from '../../jsx-generator.ts'

import type { FigmaNode, FormatOptions } from '../../types.ts'

export default defineCommand({
  meta: { description: 'Export node as JSX component' },
  args: {
    id: { type: 'positional', description: 'Node ID', required: true },
    name: { type: 'string', description: 'Component name (default: derived from node name)' },
    'match-icons': { type: 'boolean', description: 'Match vector shapes to Iconify icons (requires whaticon)' },
    'icon-threshold': { type: 'string', description: 'Icon match threshold 0-1 (default: 0.9)' },
    'prefer-icons': { type: 'string', description: 'Preferred icon sets (comma-separated, e.g., lucide,tabler)' },
    pretty: { type: 'boolean', description: 'Format output' },
    semi: { type: 'boolean', description: 'Add semicolons (default: false)' },
    'single-quote': { type: 'boolean', description: 'Use single quotes (default: true)' },
    'tab-width': { type: 'string', description: 'Spaces per indent (default: 2)' },
    tabs: { type: 'boolean', description: 'Use tabs instead of spaces' },
    'trailing-comma': { type: 'string', description: 'Trailing commas: none, es5, all (default: es5)' }
  },
  async run({ args }) {
    try {
      const node = await sendCommand<FigmaNode>('get-node-tree', {
        id: args.id
      })

      if (!node) {
        console.error('Node not found')
        process.exit(1)
      }

      await enrichWithSvgData(node)

      if (args['match-icons']) {
        const threshold = args['icon-threshold'] ? parseFloat(args['icon-threshold']) : 0.9
        const prefer = args['prefer-icons']?.split(',').map((s) => s.trim())

        const matchCount = await matchIconsInTree(node, {
          threshold,
          prefer,
          onMatch: (n, match) => {
            console.error(`Matched: ${n.name} → ${match.name} (${(match.similarity * 100).toFixed(0)}%)`)
          }
        })

        if (matchCount > 0) {
          console.error(`\nMatched ${matchCount} icon(s)\n`)
        }
      }

      const componentName = args.name || toComponentName(node.name)
      let code = generateCode(node, componentName)

      if (args.pretty) {
        code = await formatCode(code, {
          semi: args.semi,
          singleQuote: args['single-quote'] !== false,
          tabWidth: args['tab-width'] ? Number(args['tab-width']) : undefined,
          useTabs: args.tabs,
          trailingComma: args['trailing-comma'] as FormatOptions['trailingComma']
        })
      }

      console.log(code)
    } catch (e) {
      handleError(e)
    }
  }
})
