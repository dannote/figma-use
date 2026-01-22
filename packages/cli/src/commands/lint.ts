import { defineCommand } from 'citty'
import { sendCommand, printResult } from '../client.ts'
import {
  createLinter,
  formatReport,
  formatJSON,
  presets,
  type FigmaNode,
  type FigmaVariable,
} from '../../../linter/src/index.ts'

export default defineCommand({
  meta: {
    name: 'lint',
    description: 'Lint Figma designs for consistency and accessibility issues',
  },
  args: {
    root: {
      type: 'string',
      description: 'Node ID to lint (default: current page)',
    },
    preset: {
      type: 'string',
      description: 'Preset to use: recommended, strict, accessibility, design-system',
      default: 'recommended',
    },
    rule: {
      type: 'string',
      description: 'Run specific rule(s) only (can be repeated)',
    },
    fix: {
      type: 'boolean',
      description: 'Auto-fix issues where possible',
      default: false,
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Show suggestions for fixing issues',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
    'list-rules': {
      type: 'boolean',
      description: 'List available rules and exit',
      default: false,
    },
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

    // Get node tree from Figma (returned as JSON string due to size limits)
    const treeJson = await sendCommand<string>('lint-tree', {
      rootId: args.root,
    })
    const tree = JSON.parse(treeJson) as FigmaNode

    // Get variables for suggesting fixes
    const variablesJson = await sendCommand<string>('variable-list', {})
    const variables = JSON.parse(variablesJson) as FigmaVariable[]

    // Parse rules if specified
    const rules = args.rule ? (Array.isArray(args.rule) ? args.rule : [args.rule]) : undefined

    // Create and run linter
    const linter = createLinter({
      preset: args.preset,
      rules,
      variables,
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
  },
})
