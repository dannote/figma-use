/**
 * Figma-like React components
 * 
 * API inspired by react-figma but outputs JSON instead of Figma nodes
 */

import * as React from 'react'

// Re-export defineVars for use in .figma.tsx files
export { defineVars, figmaVar, isVariable, type FigmaVariable } from './vars.ts'

// Style types
interface Style {
  width?: number | string
  height?: number | string
  x?: number
  y?: number
  flexDirection?: 'row' | 'column'
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between'
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  gap?: number
  padding?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  backgroundColor?: string
  opacity?: number
  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number
  borderWidth?: number
  borderColor?: string
}

interface TextStyle extends Style {
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  fontStyle?: 'normal' | 'italic'
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
}

interface BaseProps {
  name?: string
  style?: Style
  children?: React.ReactNode
}

interface TextProps extends Omit<BaseProps, 'style'> {
  style?: TextStyle
}

interface StarProps extends BaseProps {
  pointCount?: number
}

interface PolygonProps extends BaseProps {
  pointCount?: number
}

interface InstanceProps extends BaseProps {
  componentId?: string
}

// Component factory - creates intrinsic element wrapper
const c = <T extends BaseProps>(type: string): React.FC<T> => 
  (props) => React.createElement(type, props)

// Components
export const Frame = c<BaseProps>('frame')
export const Rectangle = c<BaseProps>('rectangle')
export const Ellipse = c<BaseProps>('ellipse')
export const Text = c<TextProps>('text')
export const Line = c<BaseProps>('line')
export const Star = c<StarProps>('star')
export const Polygon = c<PolygonProps>('polygon')
export const Vector = c<BaseProps>('vector')
export const Component = c<BaseProps>('component')
export const Instance = c<InstanceProps>('instance')
export const Group = c<BaseProps>('group')
export const Page = c<BaseProps>('page')
export const View = Frame

// All component names for JSX transform
export const INTRINSIC_ELEMENTS = [
  'Frame', 'Rectangle', 'Ellipse', 'Text', 'Line', 'Star', 
  'Polygon', 'Vector', 'Component', 'Instance', 'Group', 'Page', 'View'
] as const
