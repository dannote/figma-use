import type { Rule, RuleMeta, FigmaNode, RuleContext } from './types.ts'

type RuleDefinition = {
  meta: Omit<RuleMeta, 'severity'> & { severity?: RuleMeta['severity'] }
  match?: string[]
  check: (node: FigmaNode, context: RuleContext) => void
}

export function defineRule(definition: RuleDefinition): Rule {
  return {
    meta: {
      severity: 'warning',
      ...definition.meta,
    },
    match: definition.match,
    check: definition.check,
  }
}
