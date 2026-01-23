import { defineCommand } from 'citty'

import { sendCommand, handleError } from '../../client.ts'
import { loadConfig, mergeWithDefaults } from '../../config.ts'
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
    'match-icons': {
      type: 'boolean',
      description: 'Match vector shapes to Iconify icons (requires whaticon)'
    },
    'icon-threshold': { type: 'string', description: 'Icon match threshold 0-1 (default: 0.9)' },
    'prefer-icons': {
      type: 'string',
      description: 'Preferred icon sets (comma-separated, e.g., lucide,tabler)'
    },
    verbose: { type: 'boolean', alias: 'v', description: 'Show matched icons' },
    'no-semantic-html': { type: 'boolean', description: 'Disable semantic HTML conversion' },
    pretty: { type: 'boolean', description: 'Format output' },
    semi: { type: 'boolean', description: 'Add semicolons (default: false)' },
    'single-quote': { type: 'boolean', description: 'Use single quotes (default: true)' },
    'tab-width': { type: 'string', description: 'Spaces per indent (default: 2)' },
    tabs: { type: 'boolean', description: 'Use tabs instead of spaces' },
    'trailing-comma': {
      type: 'string',
      description: 'Trailing commas: none, es5, all (default: es5)'
    }
  },
  async run({ args }) {
    try {
      // Load config
      const fileConfig = loadConfig()
      const config = mergeWithDefaults(fileConfig)

      const node = await sendCommand<FigmaNode>('get-node-tree', {
        id: args.id
      })

      if (!node) {
        console.error('Node not found')
        process.exit(1)
      }

      await enrichWithSvgData(node)

      // Use config values if CLI args not provided
      const matchIcons = args['match-icons'] ?? config.storybook.matchIcons
      if (matchIcons) {
        const threshold = args['icon-threshold']
          ? parseFloat(args['icon-threshold'])
          : (config.storybook.iconThreshold ?? 0.85)
        const prefer = args['prefer-icons']
          ? args['prefer-icons'].split(',').map((s: string) => s.trim())
          : config.storybook.preferIcons

        const matchCount = await matchIconsInTree(node, {
          threshold,
          prefer,
          onMatch: args.verbose
            ? (n, match) => {
                console.error(
                  `Matched: ${n.name} → ${match.name} (${(match.similarity * 100).toFixed(0)}%)`
                )
              }
            : undefined
        })

        if (args.verbose && matchCount > 0) {
          console.error(`Matched ${matchCount} icon(s)\n`)
        }
      }

      const componentName = args.name || toComponentName(node.name)
      const semanticHtml = !args['no-semantic-html']
      let code = generateCode(node, componentName, { semanticHtml })

      const shouldFormat = args.pretty ?? config.format.pretty
      if (shouldFormat) {
        code = await formatCode(code, {
          semi: args.semi ?? config.format.semi,
          singleQuote: args['single-quote'] ?? config.format.singleQuote ?? true,
          tabWidth: args['tab-width'] ? Number(args['tab-width']) : config.format.tabWidth,
          useTabs: args.tabs ?? config.format.tabs,
          trailingComma: (args['trailing-comma'] ??
            config.format.trailingComma) as FormatOptions['trailingComma']
        })
      }

      console.log(code)
    } catch (e) {
      handleError(e)
    }
  }
})
