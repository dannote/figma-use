export type StyleValue = string | number | boolean

export interface StyleProps {
  // Size
  w?: number
  h?: number
  width?: number
  height?: number
  // Colors
  bg?: string
  backgroundColor?: string
  // Border
  rounded?: number
  borderRadius?: number
  // Padding
  p?: number
  pt?: number
  pr?: number
  pb?: number
  pl?: number
  px?: number
  py?: number
  padding?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  // Text
  size?: number
  font?: string
  weight?: string | number
  fontSize?: number
  fontFamily?: string
  fontWeight?: string | number
  // Layout
  flex?: 'row' | 'col' | 'column'
  flexDirection?: 'row' | 'column'
  justify?: 'start' | 'end' | 'center' | 'between' | 'evenly'
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-evenly'
  items?: 'start' | 'end' | 'center' | 'stretch'
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch'
  gap?: number
  // Other
  opacity?: number
  color?: string
  [key: string]: StyleValue | undefined
}

/** Simple shorthand → full property mapping */
export const shorthands: Record<string, string> = {
  w: 'width',
  h: 'height',
  bg: 'backgroundColor',
  rounded: 'borderRadius',
  p: 'padding',
  pt: 'paddingTop',
  pr: 'paddingRight',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  size: 'fontSize',
  font: 'fontFamily',
  weight: 'fontWeight'
}

/** Value transformations for specific properties */
export const valueTransforms: Record<string, Record<string, string>> = {
  flexDirection: { col: 'column' },
  justifyContent: {
    start: 'flex-start',
    end: 'flex-end',
    between: 'space-between',
    evenly: 'space-evenly'
  },
  alignItems: { start: 'flex-start', end: 'flex-end' }
}

/** Normalize Tailwind-like shorthand style props to full names */
export function normalizeStyle(style: StyleProps): StyleProps {
  const result: StyleProps = {}

  // First pass: expand simple shorthands and copy non-shorthand keys
  for (const [key, value] of Object.entries(style)) {
    // Skip special shorthands handled separately
    if (key === 'px' || key === 'py' || key === 'flex' || key === 'justify' || key === 'items') {
      continue
    }

    const fullKey = shorthands[key] || key
    // Full property takes precedence - check if it exists in original style
    if (shorthands[key] && style[fullKey] !== undefined) {
      continue
    }
    if (result[fullKey] === undefined) {
      const transform = valueTransforms[fullKey]
      result[fullKey] = transform?.[value as string] ?? value
    }
  }

  // Expand px/py to individual padding properties
  if (style.px !== undefined) {
    if (result.paddingLeft === undefined) result.paddingLeft = style.px
    if (result.paddingRight === undefined) result.paddingRight = style.px
  }
  if (style.py !== undefined) {
    if (result.paddingTop === undefined) result.paddingTop = style.py
    if (result.paddingBottom === undefined) result.paddingBottom = style.py
  }

  // Expand flex shorthand
  if (style.flex !== undefined && result.flexDirection === undefined) {
    const transform = valueTransforms.flexDirection
    const value = transform?.[style.flex] ?? style.flex
    result.flexDirection = value === 'col' ? 'column' : (value as StyleProps['flexDirection'])
  }

  // Expand justify/items shorthands
  if (style.justify !== undefined && result.justifyContent === undefined) {
    const transform = valueTransforms.justifyContent
    result.justifyContent = (transform?.[style.justify] ?? style.justify) as StyleProps['justifyContent']
  }
  if (style.items !== undefined && result.alignItems === undefined) {
    const transform = valueTransforms.alignItems
    result.alignItems = (transform?.[style.items] ?? style.items) as StyleProps['alignItems']
  }

  return result
}
