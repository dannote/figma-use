import pc from 'picocolors'
import type { LintResult, LintMessage, Severity } from '../core/types.ts'

const SEVERITY_ICONS: Record<Severity, string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  off: ' ',
}

const severityColor = (severity: Severity, text: string): string => {
  switch (severity) {
    case 'error': return pc.red(text)
    case 'warning': return pc.yellow(text)
    case 'info': return pc.cyan(text)
    default: return pc.dim(text)
  }
}

export interface ConsoleReporterOptions {
  verbose?: boolean
}

export function formatReport(result: LintResult, options: ConsoleReporterOptions = {}): string {
  const { verbose = false } = options
  const lines: string[] = []

  // Group messages by node
  const byNode = new Map<string, LintMessage[]>()
  for (const msg of result.messages) {
    const key = `${msg.nodePath.join('/')} (${msg.nodeId})`
    const existing = byNode.get(key) ?? []
    existing.push(msg)
    byNode.set(key, existing)
  }

  for (const [nodePath, messages] of byNode) {
    // Sort: errors first, then warnings, then info
    messages.sort((a, b) => {
      const order: Record<Severity, number> = { error: 0, warning: 1, info: 2, off: 3 }
      return order[a.severity] - order[b.severity]
    })

    const hasError = messages.some(m => m.severity === 'error')
    const icon = hasError ? pc.red('✖') : pc.yellow('⚠')
    lines.push(`${icon} ${pc.bold(nodePath)}`)

    for (const msg of messages) {
      const sevIcon = severityColor(msg.severity, SEVERITY_ICONS[msg.severity])
      const ruleId = pc.dim(msg.ruleId)
      lines.push(`    ${sevIcon}  ${msg.message}  ${ruleId}`)

      if (verbose && msg.suggest) {
        lines.push(`       ${pc.dim(`→ ${msg.suggest}`)}`)
      }
    }

    lines.push('')
  }

  // Summary line
  const parts: string[] = []
  if (result.errorCount > 0) {
    parts.push(pc.red(`${result.errorCount} error${result.errorCount !== 1 ? 's' : ''}`))
  }
  if (result.warningCount > 0) {
    parts.push(pc.yellow(`${result.warningCount} warning${result.warningCount !== 1 ? 's' : ''}`))
  }
  if (result.infoCount > 0) {
    parts.push(pc.cyan(`${result.infoCount} info`))
  }

  if (parts.length > 0) {
    lines.push('─'.repeat(60))
    lines.push(parts.join('  '))

    if (result.fixableCount > 0) {
      lines.push(pc.dim(`\nRun with --fix to auto-fix ${result.fixableCount} issue${result.fixableCount !== 1 ? 's' : ''}`))
    }
  } else {
    lines.push(pc.green('✔ No issues found'))
  }

  return lines.join('\n')
}

export function formatJSON(result: LintResult): string {
  return JSON.stringify(result, null, 2)
}
