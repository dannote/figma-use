import type {
  Rule,
  RuleContext,
  FigmaNode,
  FigmaVariable,
  LintMessage,
  LintResult,
  LintConfig,
  Severity,
  RGB,
  FixAction,
} from './types.ts'
import { getNodePath, colorDistance } from './utils.ts'
import { allRules } from '../rules/index.ts'
import { presets } from '../config/presets.ts'

export interface LinterOptions {
  config?: LintConfig
  preset?: string
  rules?: string[]
  variables?: FigmaVariable[]
}

export class Linter {
  private rules: Map<string, Rule> = new Map()
  private ruleConfigs: Map<string, { severity: Severity; options?: Record<string, unknown> }> = new Map()
  private variables: FigmaVariable[] = []
  private messages: LintMessage[] = []

  constructor(options: LinterOptions = {}) {
    this.variables = options.variables ?? []
    this.loadRules(options)
  }

  private loadRules(options: LinterOptions) {
    // Start with preset if specified
    let baseConfig: Record<string, Severity | { severity: Severity; options?: Record<string, unknown> }> = {}

    if (options.preset) {
      const preset = presets[options.preset]
      if (preset) {
        baseConfig = { ...preset.rules }
      }
    }

    // Apply extends from config
    if (options.config?.extends) {
      const extendsArr = Array.isArray(options.config.extends)
        ? options.config.extends
        : [options.config.extends]

      for (const ext of extendsArr) {
        const preset = presets[ext]
        if (preset) {
          baseConfig = { ...baseConfig, ...preset.rules }
        }
      }
    }

    // Override with explicit config rules
    if (options.config?.rules) {
      baseConfig = { ...baseConfig, ...options.config.rules }
    }

    // If specific rules requested, filter to only those
    const rulesToLoad = options.rules ?? Object.keys(baseConfig)

    for (const ruleId of rulesToLoad) {
      const rule = allRules[ruleId]
      if (!rule) continue

      const config = baseConfig[ruleId]
      if (config === 'off') continue

      this.rules.set(ruleId, rule)

      if (typeof config === 'string') {
        this.ruleConfigs.set(ruleId, { severity: config })
      } else if (config) {
        this.ruleConfigs.set(ruleId, config)
      } else {
        this.ruleConfigs.set(ruleId, { severity: rule.meta.severity })
      }
    }
  }

  lint(nodes: FigmaNode[]): LintResult {
    this.messages = []

    for (const node of nodes) {
      this.lintNode(node)
    }

    return {
      messages: this.messages,
      errorCount: this.messages.filter(m => m.severity === 'error').length,
      warningCount: this.messages.filter(m => m.severity === 'warning').length,
      infoCount: this.messages.filter(m => m.severity === 'info').length,
      fixableCount: this.messages.filter(m => m.fix).length,
    }
  }

  private lintNode(node: FigmaNode) {
    for (const [ruleId, rule] of this.rules) {
      // Check if rule applies to this node type
      if (rule.match && !rule.match.includes(node.type)) continue

      const config = this.ruleConfigs.get(ruleId)!
      const context = this.createContext(node, ruleId, config)

      try {
        rule.check(node, context)
      } catch (error) {
        console.error(`Error in rule ${ruleId}:`, error)
      }
    }

    // Recursively lint children
    if (node.children) {
      for (const child of node.children) {
        // Set parent reference for traversal
        ;(child as { parent?: FigmaNode }).parent = node
        this.lintNode(child)
      }
    }
  }

  private createContext(
    node: FigmaNode,
    ruleId: string,
    config: { severity: Severity; options?: Record<string, unknown> }
  ): RuleContext {
    return {
      report: (issue: { node: FigmaNode; message: string; suggest?: string; fix?: FixAction }) => {
        this.messages.push({
          ruleId,
          severity: config.severity,
          message: issue.message,
          nodeId: issue.node.id,
          nodeName: issue.node.name,
          nodePath: getNodePath(issue.node),
          suggest: issue.suggest,
          fix: issue.fix,
        })
      },

      getVariables: () => this.variables,

      findSimilarVariable: (value: RGB | number, type: 'COLOR' | 'FLOAT') => {
        if (type === 'COLOR' && typeof value === 'object') {
          let closest: FigmaVariable | null = null
          let minDistance = Infinity

          for (const variable of this.variables) {
            if (variable.resolvedType !== 'COLOR') continue

            for (const modeValue of Object.values(variable.valuesByMode)) {
              if (typeof modeValue !== 'object' || !modeValue) continue
              const varColor = modeValue as RGB
              if (varColor.r === undefined) continue

              const distance = colorDistance(value, varColor)
              if (distance < minDistance) {
                minDistance = distance
                closest = variable
              }
            }
          }

          // Only suggest if very close (threshold ~5% difference)
          return minDistance < 0.1 ? closest : null
        }

        return null
      },

      getConfig: <T>() => config.options as T,
    }
  }
}

export function createLinter(options?: LinterOptions): Linter {
  return new Linter(options)
}
