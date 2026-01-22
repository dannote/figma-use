import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface FigmaUseConfig {
  lint?: {
    preset?: 'recommended' | 'strict' | 'accessibility' | 'design-system'
    rules?: Record<string, 'off' | 'info' | 'warning' | 'error'>
  }
  storybook?: {
    page?: string
    out?: string
    matchIcons?: boolean
    preferIcons?: string[]
    iconThreshold?: number
    framework?: 'react' | 'vue'
  }
  format?: {
    pretty?: boolean
    semi?: boolean
    singleQuote?: boolean
    tabs?: boolean
    tabWidth?: number
    trailingComma?: 'none' | 'es5' | 'all'
  }
}

const CONFIG_FILENAME = '.figma-use.json'

let cachedConfig: FigmaUseConfig | null = null
let cachedConfigPath: string | null = null

export function findConfigPath(startDir: string = process.cwd()): string | null {
  let dir = startDir
  while (dir !== '/') {
    const configPath = join(dir, CONFIG_FILENAME)
    if (existsSync(configPath)) {
      return configPath
    }
    dir = join(dir, '..')
  }
  return null
}

export function loadConfig(startDir?: string): FigmaUseConfig {
  if (cachedConfig && cachedConfigPath === startDir) {
    return cachedConfig
  }

  const configPath = findConfigPath(startDir)
  if (!configPath) {
    return {}
  }

  try {
    const content = readFileSync(configPath, 'utf-8')
    cachedConfig = JSON.parse(content) as FigmaUseConfig
    cachedConfigPath = startDir ?? process.cwd()
    return cachedConfig
  } catch {
    return {}
  }
}

export function getDefaultConfig(): FigmaUseConfig {
  return {
    lint: {
      preset: 'recommended'
    },
    storybook: {
      out: './stories',
      matchIcons: false,
      preferIcons: ['lucide', 'tabler'],
      iconThreshold: 0.85,
      framework: 'react'
    },
    format: {
      pretty: true,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'none'
    }
  }
}

export function mergeWithDefaults(config: FigmaUseConfig): Required<FigmaUseConfig> {
  const defaults = getDefaultConfig()
  return {
    lint: { ...defaults.lint, ...config.lint },
    storybook: { ...defaults.storybook, ...config.storybook },
    format: { ...defaults.format, ...config.format }
  } as Required<FigmaUseConfig>
}

export { CONFIG_FILENAME }
