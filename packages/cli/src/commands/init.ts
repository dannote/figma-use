import { defineCommand } from 'citty'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { yellow, cyan, green, bold, red } from 'agentfmt'

import { CONFIG_FILENAME, getDefaultConfig, findConfigPath } from '../config.ts'

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Create .figma-use.json config file'
  },
  args: {
    force: {
      type: 'boolean',
      alias: 'f',
      description: 'Overwrite existing config',
      default: false
    },
    preset: {
      type: 'string',
      description: 'Lint preset: recommended, strict, accessibility, design-system',
      default: 'recommended'
    }
  },
  async run({ args }) {
    const configPath = join(process.cwd(), CONFIG_FILENAME)

    if (existsSync(configPath) && !args.force) {
      const existingPath = findConfigPath()
      console.log(`${yellow('!')} Config already exists: ${existingPath}`)
      console.log(`  Use ${cyan('--force')} to overwrite`)
      return
    }

    const config = getDefaultConfig()
    
    // Apply preset if specified
    if (args.preset && args.preset !== 'recommended') {
      config.lint!.preset = args.preset as 'recommended' | 'strict' | 'accessibility' | 'design-system'
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
    console.log(`${green('✓')} Created ${cyan(CONFIG_FILENAME)}`)
    console.log()
    console.log('  Settings:')
    console.log(`    lint.preset: ${yellow(config.lint!.preset!)}`)
    console.log(`    storybook.preferIcons: ${yellow(config.storybook!.preferIcons!.join(', '))}`)
    console.log(`    format.pretty: ${yellow('true')}`)
  }
})
