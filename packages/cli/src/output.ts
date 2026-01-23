import { ok, fail, dim, entity, list as fmtList, kv } from 'agentfmt'

import { formatFill, formatStroke, formatBox, formatType } from './format.ts'

import type { FigmaNode, FigmaPage, DeletedResult, ExportResult, StatusResult } from './types.ts'

function formatNode(node: Record<string, unknown>, indent = ''): string {
  const lines: string[] = []
  const type = formatType(node.type as string)
  const name = node.name || node.characters || ''
  const id = node.id

  lines.push(`${indent}${entity(type, String(name), String(id))}`)

  const details: string[] = []

  const box = formatBox(node as { width?: number; height?: number; x?: number; y?: number })
  if (box) details.push(`box: ${box}`)

  const fill = formatFill(node.fills as FigmaNode['fills'])
  if (fill) details.push(`fill: ${fill}`)

  const stroke = formatStroke(node.strokes as FigmaNode['strokes'], node.strokeWeight as number)
  if (stroke) details.push(`stroke: ${stroke}`)

  if (node.cornerRadius && node.cornerRadius !== 0) {
    let radiusStr = `${node.cornerRadius}px`
    if (node.cornerSmoothing && node.cornerSmoothing > 0) {
      radiusStr += ` (smooth: ${Math.round((node.cornerSmoothing as number) * 100)}%)`
    }
    details.push(`radius: ${radiusStr}`)
  }

  // Individual corner radii if different
  if (node.topLeftRadius !== undefined || node.topRightRadius !== undefined) {
    const tl = node.topLeftRadius ?? node.cornerRadius ?? 0
    const tr = node.topRightRadius ?? node.cornerRadius ?? 0
    const bl = node.bottomLeftRadius ?? node.cornerRadius ?? 0
    const br = node.bottomRightRadius ?? node.cornerRadius ?? 0
    if (tl !== tr || tr !== bl || bl !== br) {
      let cornerStr = `↖${tl} ↗${tr} ↘${br} ↙${bl}`
      if (node.cornerSmoothing && (node.cornerSmoothing as number) > 0) {
        cornerStr += ` (smooth: ${Math.round((node.cornerSmoothing as number) * 100)}%)`
      }
      details.push(`corners: ${cornerStr}`)
    }
  }

  // Effects (shadows, blur)
  if (node.effects && Array.isArray(node.effects) && node.effects.length > 0) {
    const effectStrs = (node.effects as Array<{ type: string; radius?: number }>).map((e) => {
      if (e.type === 'DROP_SHADOW') return `shadow(${e.radius || 0}px)`
      if (e.type === 'INNER_SHADOW') return `inner-shadow(${e.radius || 0}px)`
      if (e.type === 'LAYER_BLUR') return `blur(${e.radius || 0}px)`
      if (e.type === 'BACKGROUND_BLUR') return `backdrop-blur(${e.radius || 0}px)`
      return e.type.toLowerCase()
    })
    details.push(`effects: ${effectStrs.join(', ')}`)
  }

  // Rotation
  if (node.rotation && node.rotation !== 0) {
    details.push(`rotate: ${Math.round(node.rotation as number)}°`)
  }

  // Blend mode
  if (node.blendMode && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
    details.push(`blend: ${(node.blendMode as string).toLowerCase().replace(/_/g, '-')}`)
  }

  // Clips content
  if (node.clipsContent) {
    details.push(`overflow: hidden`)
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
    let layoutStr = `${(node.layoutMode as string).toLowerCase()}`
    if (node.layoutWrap === 'WRAP') layoutStr += ' wrap'
    if (node.itemSpacing) layoutStr += ` gap=${node.itemSpacing}`
    details.push(`flex: ${layoutStr}`)
  }

  // Min/max constraints
  const constraints: string[] = []
  if (node.minWidth !== undefined && node.minWidth !== null)
    constraints.push(`min-w: ${node.minWidth}`)
  if (node.maxWidth !== undefined && node.maxWidth !== null)
    constraints.push(`max-w: ${node.maxWidth}`)
  if (node.minHeight !== undefined && node.minHeight !== null)
    constraints.push(`min-h: ${node.minHeight}`)
  if (node.maxHeight !== undefined && node.maxHeight !== null)
    constraints.push(`max-h: ${node.maxHeight}`)
  if (constraints.length > 0) {
    details.push(constraints.join(', '))
  }

  // Layout positioning
  if (node.layoutPositioning === 'ABSOLUTE') {
    details.push(`position: absolute`)
  }

  // Layout grow
  if (node.layoutGrow && (node.layoutGrow as number) > 0) {
    details.push(`grow: ${node.layoutGrow}`)
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
  const items = nodes.map((node) => {
    const type = formatType(node.type as string)
    const name = node.name || node.characters || ''
    const id = node.id
    const box = formatBox(node as { width?: number; height?: number; x?: number; y?: number })

    const details: Record<string, unknown> = {}
    if (box) details.box = box

    const fill = formatFill(node.fills as FigmaNode['fills'])
    if (fill) details.fill = fill

    const stroke = formatStroke(node.strokes as FigmaNode['strokes'], node.strokeWeight as number)
    if (stroke) details.stroke = stroke

    if (node.cornerRadius && node.cornerRadius !== 0) {
      details.radius = `${node.cornerRadius}px`
    }

    return {
      header: `${type} "${name}" (${id})`,
      details: Object.keys(details).length > 0 ? details : undefined
    }
  })

  return fmtList(items)
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
  const items = pages.map((p) => ({
    header: `"${p.name}" (${p.id})`
  }))
  return fmtList(items)
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
