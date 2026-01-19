/**
 * Serialize/deserialize Figma nodes to/from text format for unified diff.
 *
 * Format:
 *   type: RECTANGLE
 *   size: 100 50
 *   pos: 200 150
 *   fill: #FF0000
 *   opacity: 0.8
 */

export interface NodeProps {
  type: string
  name?: string
  size?: [number, number]
  pos?: [number, number]
  fill?: string
  stroke?: string
  strokeWeight?: number
  opacity?: number
  radius?: number | [number, number, number, number]
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  text?: string
  visible?: boolean
  locked?: boolean
}

export function serializeNode(node: Record<string, unknown>): string {
  const lines: string[] = []

  lines.push(`type: ${node.type}`)

  if (node.width !== undefined && node.height !== undefined) {
    lines.push(`size: ${node.width} ${node.height}`)
  }

  if (node.x !== undefined && node.y !== undefined) {
    lines.push(`pos: ${node.x} ${node.y}`)
  }

  // Fill color (first solid fill)
  const fills = node.fills as Array<{ type: string; color?: string }> | undefined
  const firstFill = fills?.[0]
  if (firstFill?.type === 'SOLID' && firstFill.color) {
    lines.push(`fill: ${firstFill.color}`)
  }

  // Stroke color (first solid stroke)
  const strokes = node.strokes as Array<{ type: string; color?: string }> | undefined
  const firstStroke = strokes?.[0]
  if (firstStroke?.type === 'SOLID' && firstStroke.color) {
    lines.push(`stroke: ${firstStroke.color}`)
  }

  if (node.strokeWeight !== undefined && node.strokeWeight !== 0) {
    lines.push(`strokeWeight: ${node.strokeWeight}`)
  }

  if (node.opacity !== undefined && node.opacity !== 1) {
    lines.push(`opacity: ${roundTo(node.opacity as number, 2)}`)
  }

  if (node.cornerRadius !== undefined && node.cornerRadius !== 0) {
    lines.push(`radius: ${node.cornerRadius}`)
  }

  // Text-specific
  if (node.type === 'TEXT') {
    if (node.characters !== undefined) {
      lines.push(`text: ${JSON.stringify(node.characters)}`)
    }
    if (node.fontSize !== undefined) {
      lines.push(`fontSize: ${node.fontSize}`)
    }
    if (node.fontName !== undefined) {
      const fontName = node.fontName as { family?: string; style?: string }
      if (fontName.family) {
        lines.push(`fontFamily: ${fontName.family}`)
      }
    }
  }

  if (node.visible === false) {
    lines.push(`visible: false`)
  }

  if (node.locked === true) {
    lines.push(`locked: true`)
  }

  return lines.join('\n')
}

export function deserializeNode(text: string): NodeProps {
  const props: NodeProps = { type: 'UNKNOWN' }

  for (const line of text.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()

    switch (key) {
      case 'type':
        props.type = value
        break
      case 'name':
        props.name = value
        break
      case 'size': {
        const parts = value.split(' ').map(Number)
        props.size = [parts[0] ?? 0, parts[1] ?? 0]
        break
      }
      case 'pos': {
        const parts = value.split(' ').map(Number)
        props.pos = [parts[0] ?? 0, parts[1] ?? 0]
        break
      }
      case 'fill':
        props.fill = value
        break
      case 'stroke':
        props.stroke = value
        break
      case 'strokeWeight':
        props.strokeWeight = Number(value)
        break
      case 'opacity':
        props.opacity = Number(value)
        break
      case 'radius':
        props.radius = Number(value)
        break
      case 'fontSize':
        props.fontSize = Number(value)
        break
      case 'fontFamily':
        props.fontFamily = value
        break
      case 'fontWeight':
        props.fontWeight = Number(value)
        break
      case 'text':
        props.text = JSON.parse(value)
        break
      case 'visible':
        props.visible = value === 'true'
        break
      case 'locked':
        props.locked = value === 'true'
        break
    }
  }

  return props
}

/**
 * Compute property changes between old and new props.
 * Returns only the fields that differ.
 */
export function diffProps(oldProps: NodeProps, newProps: NodeProps): Partial<NodeProps> {
  const changes: Partial<NodeProps> = {}

  for (const key of Object.keys(newProps) as Array<keyof NodeProps>) {
    const oldVal = oldProps[key]
    const newVal = newProps[key]

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      if (oldVal.join(',') !== newVal.join(',')) {
        ;(changes as Record<string, unknown>)[key] = newVal
      }
    } else if (oldVal !== newVal) {
      ;(changes as Record<string, unknown>)[key] = newVal
    }
  }

  return changes
}

function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
}
