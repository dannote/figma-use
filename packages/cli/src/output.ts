import { formatFill, formatStroke, formatBox, formatType, ok, fail, dim } from './format.ts'

import type { FigmaNode, FigmaPage, DeletedResult, ExportResult, StatusResult } from './types.ts'

function formatNode(node: Record<string, unknown>, indent = ''): string {
  const lines: string[] = []
  const type = formatType(node.type as string)
  const name = node.name || node.characters || ''
  const id = node.id

  lines.push(`${indent}[${type}] "${name}" (${id})`)

  const details: string[] = []

  const box = formatBox(node as { width?: number; height?: number; x?: number; y?: number })
  if (box) details.push(`box: ${box}`)

  const fill = formatFill(node.fills as FigmaNode['fills'])
  if (fill) details.push(`fill: ${fill}`)

  const stroke = formatStroke(node.strokes as FigmaNode['strokes'], node.strokeWeight as number)
  if (stroke) details.push(`stroke: ${stroke}`)

  if (node.cornerRadius && node.cornerRadius !== 0) {
    details.push(`radius: ${node.cornerRadius}px`)
  }

  if (node.fontSize) {
    const family = node.fontFamily || ''
    const style = node.fontStyle || ''
    details.push(`font: ${node.fontSize}px ${family} ${style}`.trim())
  }

  if (node.characters && !name) {
    details.push(`text: "${node.characters}"`)
  }

  if (node.childCount !== undefined && typeof node.childCount === 'number' && node.childCount > 0) {
    details.push(`children: ${node.childCount}`)
  }

  if (node.layoutMode) {
    details.push(`layout: ${node.layoutMode}`)
  }

  if (node.opacity !== undefined && node.opacity !== 1) {
    details.push(`opacity: ${node.opacity}`)
  }

  for (const detail of details) {
    lines.push(`${indent}  ${detail}`)
  }

  // Component property definitions (for component sets)
  const propDefs = node.componentPropertyDefinitions as
    | Record<string, { type: string; defaultValue?: string; variantOptions?: string[] }>
    | undefined
  if (propDefs && Object.keys(propDefs).length > 0) {
    lines.push('')
    lines.push(`${indent}  variants:`)
    for (const [propName, def] of Object.entries(propDefs)) {
      if (def.type === 'VARIANT' && def.variantOptions) {
        const defaultMark = def.defaultValue ? ` (default: ${def.defaultValue})` : ''
        lines.push(`${indent}    ${propName}: ${def.variantOptions.join(' | ')}${defaultMark}`)
      }
    }
  }

  // Component properties (for instances)
  const props = node.componentProperties as
    | Record<string, { type: string; value: unknown }>
    | undefined
  if (props && Object.keys(props).length > 0) {
    lines.push('')
    lines.push(`${indent}  properties:`)
    for (const [propName, prop] of Object.entries(props)) {
      lines.push(`${indent}    ${propName}: ${prop.value}`)
    }
  }

  return lines.join('\n')
}

function formatNodeList(nodes: Array<Record<string, unknown>>): string {
  return nodes
    .map((node, i) => {
      const type = formatType(node.type as string)
      const name = node.name || node.characters || ''
      const id = node.id
      const box = formatBox(node as { width?: number; height?: number; x?: number; y?: number })

      const details: string[] = []
      if (box) details.push(`box: ${box}`)

      const fill = formatFill(node.fills as FigmaNode['fills'])
      if (fill) details.push(`fill: ${fill}`)

      const stroke = formatStroke(node.strokes as FigmaNode['strokes'], node.strokeWeight as number)
      if (stroke) details.push(`stroke: ${stroke}`)

      if (node.cornerRadius && node.cornerRadius !== 0) {
        details.push(`radius: ${node.cornerRadius}px`)
      }

      let line = `[${i}] ${type} "${name}" (${id})`
      if (details.length > 0) {
        line += '\n    ' + details.join('\n    ')
      }
      return line
    })
    .join('\n\n')
}

function formatCreated(node: Record<string, unknown>, action = 'Created'): string {
  const type = formatType(node.type as string)
  const name = node.name || node.characters || ''

  const lines = [ok(`${action} ${type} "${name}"`)]
  lines.push(`  id: ${node.id}`)

  const box = formatBox(node as { width?: number; height?: number; x?: number; y?: number })
  if (box) lines.push(`  box: ${box}`)

  const fill = formatFill(node.fills as FigmaNode['fills'])
  if (fill) lines.push(`  fill: ${fill}`)

  const stroke = formatStroke(node.strokes as FigmaNode['strokes'], node.strokeWeight as number)
  if (stroke) lines.push(`  stroke: ${stroke}`)

  if (node.cornerRadius && node.cornerRadius !== 0) {
    lines.push(`  radius: ${node.cornerRadius}px`)
  }

  if (node.fontSize) {
    lines.push(`  font: ${node.fontSize}px`)
  }

  return lines.join('\n')
}

function formatExport(result: ExportResult): string {
  return result.filename ? ok(`Exported to ${result.filename}`) : ok('Exported')
}

function formatDeleted(result: DeletedResult): string {
  return result.deleted ? ok('Deleted') : fail('Delete failed')
}

function formatPages(pages: FigmaPage[]): string {
  return pages.map((p, i) => `[${i}] "${p.name}" (${p.id})`).join('\n')
}

function formatStatus(status: StatusResult): string {
  return status.pluginConnected ? ok('Plugin connected') : fail('Plugin not connected')
}

export function formatResult(result: unknown, context?: string): string {
  if (result === null || result === undefined) {
    return ''
  }

  if (typeof result === 'string') {
    return result
  }

  if (Array.isArray(result)) {
    if (result.length === 0) return '(empty)'
    if (result[0]?.id && result[0]?.name !== undefined) {
      if (result[0]?.type) {
        return formatNodeList(result as Array<Record<string, unknown>>)
      }
      return formatPages(result as FigmaPage[])
    }
    return JSON.stringify(result, null, 2)
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    if ('deleted' in obj && obj.deleted !== undefined) {
      return formatDeleted({ deleted: Boolean(obj.deleted) })
    }

    if (context === 'path' && 'paths' in obj) {
      const paths = obj.paths as Array<{ data: string }>
      return ok('Path updated') + '\n' + paths.map((p) => dim(p.data)).join('\n')
    }

    if ('updated' in obj && obj.updated === true) {
      return ok('Updated')
    }

    if (context === 'export' || 'data' in obj) {
      return formatExport({
        data: String(obj.data ?? ''),
        filename: obj.filename as string | undefined
      })
    }

    if ('pluginConnected' in obj) {
      return formatStatus({ pluginConnected: Boolean(obj.pluginConnected) })
    }

    if (obj.id && obj.type) {
      if (context === 'create') {
        return formatCreated(obj, 'Created')
      }
      if (context === 'update') {
        return formatCreated(obj, 'Updated')
      }
      return formatNode(obj)
    }

    if (obj.id && obj.name && !obj.type) {
      return `[page] "${obj.name}" (${obj.id})`
    }

    if (obj.center && obj.zoom) {
      return ok(`Zoomed to fit (${((obj.zoom as number) * 100).toFixed(0)}%)`)
    }

    if (obj.selection !== undefined) {
      const sel = obj.selection as string[]
      if (sel.length === 0) return '(no selection)'
      return `Selected: ${sel.join(', ')}`
    }

    return JSON.stringify(obj, null, 2)
  }

  return String(result)
}

export function printResult(result: unknown, jsonMode = false, context?: string): void {
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(formatResult(result, context))
  }
}

export function printError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(fail(message))
}
