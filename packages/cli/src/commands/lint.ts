import { defineCommand } from 'citty'

import {
  createLinter,
  formatReport,
  formatJSON,
  presets,
  type FigmaNode,
  type FigmaVariable
} from '../../../linter/src/index.ts'
import { sendCommand } from '../client.ts'
import { loadConfig, mergeWithDefaults } from '../config.ts'

export default defineCommand({
  meta: {
    name: 'lint',
    description: 'Lint Figma designs for consistency and accessibility issues'
  },
  args: {
    root: {
      type: 'string',
      description: 'Node ID to lint (default: current page)'
    },
    page: {
      type: 'string',
      description: 'Page name to lint (partial match supported)'
    },
    preset: {
      type: 'string',
      description: 'Preset to use: recommended, strict, accessibility, design-system',
      default: 'recommended'
    },
    rule: {
      type: 'string',
      description: 'Run specific rule(s) only (can be repeated)'
    },
    fix: {
      type: 'boolean',
      description: 'Auto-fix issues where possible',
      default: false
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Show suggestions for fixing issues',
      default: false
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false
    },
    'list-rules': {
      type: 'boolean',
      description: 'List available rules and exit',
      default: false
    }
  },
  async run({ args }) {
    // List rules mode
    if (args['list-rules']) {
      const { allRules } = await import('../../../linter/src/rules/index.ts')
      console.log('\nAvailable rules:\n')
      for (const [id, rule] of Object.entries(allRules)) {
        const fixable = rule.meta.fixable ? ' 🔧' : ''
        console.log(`  ${id}${fixable}`)
        console.log(`    ${rule.meta.description}`)
        console.log(`    Category: ${rule.meta.category}`)
        console.log()
      }

      console.log('Presets:')
      for (const name of Object.keys(presets)) {
        console.log(`  - ${name}`)
      }
      return
    }

    // Resolve page name to ID if specified
    let rootId = args.root
    if (args.page) {
      const pageId = await sendCommand<string | null>('find-page', { name: args.page })
      if (!pageId) {
        console.error(`Page "${args.page}" not found`)
        process.exit(1)
      }
      rootId = pageId
    }

    // Get node tree from Figma (returned as JSON string due to size limits)
    const treeJson = await sendCommand<string>('lint-tree', {
      rootId
    })
    const tree = JSON.parse(treeJson) as FigmaNode

    // Get variables for suggesting fixes
    const variablesJson = await sendCommand<string>('variable-list', {})
    const variables = JSON.parse(variablesJson) as FigmaVariable[]

    // Load config and merge with CLI args
    const fileConfig = loadConfig()
    const config = mergeWithDefaults(fileConfig)

    // CLI args override config
    const preset = args.preset !== 'recommended' ? args.preset : config.lint.preset
    const rules = args.rule ? (Array.isArray(args.rule) ? args.rule : [args.rule]) : undefined

    // Create and run linter
    const linter = createLinter({
      preset,
      rules,
      variables
    })

    const result = linter.lint([tree])

    // Output
    if (args.json) {
      console.log(formatJSON(result))
    } else {
      console.log(formatReport(result, { verbose: args.verbose }))
    }

    // Exit with error code if there are errors
    if (result.errorCount > 0) {
      process.exit(1)
    }
  }
})
