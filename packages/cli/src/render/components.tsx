/**
 * Figma-like React components
 * 
 * API inspired by react-figma but outputs JSON instead of Figma nodes
 */

import * as React from 'react'

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

// Component implementations
export const Frame: React.FC<BaseProps> = (props) => {
  return React.createElement('frame', props)
}

export const Rectangle: React.FC<BaseProps> = (props) => {
  return React.createElement('rectangle', props)
}

export const Ellipse: React.FC<BaseProps> = (props) => {
  return React.createElement('ellipse', props)
}

export const Text: React.FC<TextProps> = (props) => {
  return React.createElement('text', props)
}

export const Line: React.FC<BaseProps> = (props) => {
  return React.createElement('line', props)
}

export const Star: React.FC<StarProps> = (props) => {
  return React.createElement('star', props)
}

export const Polygon: React.FC<PolygonProps> = (props) => {
  return React.createElement('polygon', props)
}

export const Vector: React.FC<BaseProps> = (props) => {
  return React.createElement('vector', props)
}

export const Component: React.FC<BaseProps> = (props) => {
  return React.createElement('component', props)
}

export const Instance: React.FC<InstanceProps> = (props) => {
  return React.createElement('instance', props)
}

export const Group: React.FC<BaseProps> = (props) => {
  return React.createElement('group', props)
}

export const Page: React.FC<BaseProps> = (props) => {
  return React.createElement('page', props)
}

// Alias for react-native compatibility
export const View = Frame
