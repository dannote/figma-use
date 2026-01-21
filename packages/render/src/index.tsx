import React, { CSSProperties, ReactNode } from 'react'

interface BaseProps {
  name?: string
  children?: ReactNode
  w?: number
  h?: number
  x?: number
  y?: number
  bg?: string
  stroke?: string
  strokeWidth?: number
  rounded?: number
  opacity?: number
  flex?: 'row' | 'col'
  gap?: number
  p?: number
  px?: number
  py?: number
  pt?: number
  pr?: number
  pb?: number
  pl?: number
  justify?: 'start' | 'center' | 'end' | 'between'
  items?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  style?: CSSProperties
}

interface TextProps extends Omit<BaseProps, 'children'> {
  children?: string | number
  size?: number
  weight?: number | 'bold' | 'normal'
  color?: string
  font?: string
  textAlign?: 'left' | 'center' | 'right'
}

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

function propsToStyle(props: BaseProps): CSSProperties {
  const style: CSSProperties = {
    boxSizing: 'border-box'
  }

  if (props.w !== undefined) style.width = props.w
  if (props.h !== undefined) style.height = props.h
  if (props.x !== undefined) style.left = props.x
  if (props.y !== undefined) style.top = props.y
  if (props.bg) style.backgroundColor = props.bg
  if (props.stroke) style.borderColor = props.stroke
  if (props.strokeWidth) style.borderWidth = props.strokeWidth
  if (props.stroke || props.strokeWidth) style.borderStyle = 'solid'
  if (props.rounded !== undefined) style.borderRadius = props.rounded
  if (props.opacity !== undefined) style.opacity = props.opacity

  if (props.flex) {
    style.display = 'flex'
    style.flexDirection = props.flex === 'col' ? 'column' : 'row'
  }

  if (props.gap !== undefined) style.gap = props.gap

  // Padding
  if (props.p !== undefined) style.padding = props.p
  if (props.px !== undefined) {
    style.paddingLeft = props.px
    style.paddingRight = props.px
  }
  if (props.py !== undefined) {
    style.paddingTop = props.py
    style.paddingBottom = props.py
  }
  if (props.pt !== undefined) style.paddingTop = props.pt
  if (props.pr !== undefined) style.paddingRight = props.pr
  if (props.pb !== undefined) style.paddingBottom = props.pb
  if (props.pl !== undefined) style.paddingLeft = props.pl

  // Alignment
  if (props.justify) {
    const justifyMap: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      between: 'space-between'
    }
    style.justifyContent = justifyMap[props.justify]
  }

  if (props.items) {
    const itemsMap: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      stretch: 'stretch',
      baseline: 'baseline'
    }
    style.alignItems = itemsMap[props.items]
  }

  return { ...style, ...props.style }
}

export function Frame(props: BaseProps) {
  const { children, name, ...rest } = props
  return (
    <div style={propsToStyle(rest)} data-name={name}>
      {children}
    </div>
  )
}

export function Text(props: TextProps) {
  const { children, name, size, weight, color, font, textAlign, ...rest } = props
  const style: CSSProperties = {
    ...propsToStyle(rest),
    fontSize: size,
    fontWeight: weight === 'bold' ? 700 : weight,
    color,
    fontFamily: font ? `"${font}", ${SYSTEM_FONT}` : SYSTEM_FONT,
    textAlign
  }

  return (
    <span style={style} data-name={name}>
      {children}
    </span>
  )
}

export function Rectangle(props: BaseProps) {
  return <Frame {...props} />
}

export function Ellipse(props: BaseProps) {
  const style = propsToStyle(props)
  return (
    <div
      style={{ ...style, borderRadius: '50%' }}
      data-name={props.name}
    >
      {props.children}
    </div>
  )
}

export function Line(props: BaseProps) {
  const { w = 100, h = 1, stroke = '#000', strokeWidth = 1 } = props
  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundColor: stroke,
        ...propsToStyle(props)
      }}
      data-name={props.name}
    />
  )
}

interface ImageProps extends BaseProps {
  src: string
}

export function Image(props: ImageProps) {
  const { src, w, h, name, rounded, ...rest } = props
  return (
    <img
      src={src}
      width={w}
      height={h}
      style={{ borderRadius: rounded, ...propsToStyle(rest) }}
      data-name={name}
    />
  )
}

interface SVGProps extends BaseProps {
  src: string
}

export function SVG(props: SVGProps) {
  const { src, w, h, name } = props
  // For inline SVG string, render directly
  if (src.startsWith('<svg')) {
    return (
      <div
        style={{ width: w, height: h }}
        data-name={name}
        dangerouslySetInnerHTML={{ __html: src }}
      />
    )
  }
  // For URL, use img
  return <img src={src} width={w} height={h} data-name={name} />
}

export function Group(props: BaseProps) {
  return <Frame {...props} />
}

export function Section(props: BaseProps) {
  return <Frame {...props} />
}

interface IconProps {
  name: string
  size?: number
  color?: string
}

export function Icon({ name, size = 24, color = 'currentColor' }: IconProps) {
  // Fetch from Iconify CDN
  const [prefix, iconName] = name.split(':')
  const src = `https://api.iconify.design/${prefix}/${iconName}.svg?color=${encodeURIComponent(color)}`

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={name}
      style={{ display: 'inline-block' }}
    />
  )
}

// Aliases
export const View = Frame
export const Rect = Rectangle
export const Component = Frame
export const Instance = Frame
export const Page = Frame
export const Vector = Frame
export const Star = Frame
export const Polygon = Frame

// Stubs for Figma-specific APIs (no-op in browser)
export function defineVars<T extends Record<string, { name: string; value: string }>>(
  vars: T
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string }
  for (const key in vars) {
    result[key] = vars[key].value
  }
  return result
}

export function defineComponent(name: string, element: ReactNode) {
  return () => element
}

export function defineComponentSet<T extends Record<string, readonly string[]>>(
  _name: string,
  _variants: T,
  render: (props: { [K in keyof T]: T[K][number] }) => ReactNode
) {
  return render
}

export function figmaVar(_name: string, fallback: string): string {
  return fallback
}

export function isVariable(_value: unknown): boolean {
  return false
}

export function resetComponentRegistry() {}
export function getComponentRegistry() {
  return new Map()
}
export function resetComponentSetRegistry() {}
export function getComponentSetRegistry() {
  return new Map()
}
