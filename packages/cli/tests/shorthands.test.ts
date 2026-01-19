import { describe, it, expect } from 'bun:test'
import { normalizeStyle, shorthands, valueTransforms } from '../src/render/shorthands.ts'

describe('shorthands', () => {
  it('maps size shorthands', () => {
    expect(normalizeStyle({ w: 100, h: 50 })).toEqual({ width: 100, height: 50 })
  })

  it('maps color shorthands', () => {
    expect(normalizeStyle({ bg: '#FFF' })).toEqual({ backgroundColor: '#FFF' })
  })

  it('maps border radius', () => {
    expect(normalizeStyle({ rounded: 8 })).toEqual({ borderRadius: 8 })
  })

  it('maps padding shorthands', () => {
    expect(normalizeStyle({ p: 16 })).toEqual({ padding: 16 })
    expect(normalizeStyle({ pt: 8, pr: 12, pb: 8, pl: 12 })).toEqual({
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12
    })
  })

  it('expands px to paddingLeft and paddingRight', () => {
    expect(normalizeStyle({ px: 24 })).toEqual({ paddingLeft: 24, paddingRight: 24 })
  })

  it('expands py to paddingTop and paddingBottom', () => {
    expect(normalizeStyle({ py: 16 })).toEqual({ paddingTop: 16, paddingBottom: 16 })
  })

  it('px/py do not override explicit values', () => {
    expect(normalizeStyle({ px: 24, pl: 8 })).toEqual({
      paddingLeft: 8,
      paddingRight: 24
    })
    expect(normalizeStyle({ py: 16, pt: 4 })).toEqual({
      paddingTop: 4,
      paddingBottom: 16
    })
  })

  it('maps text shorthands', () => {
    expect(normalizeStyle({ size: 16, font: 'Inter', weight: 'bold' })).toEqual({
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 'bold'
    })
  })

  it('maps flex shorthand with value transform', () => {
    expect(normalizeStyle({ flex: 'col' })).toEqual({ flexDirection: 'column' })
    expect(normalizeStyle({ flex: 'row' })).toEqual({ flexDirection: 'row' })
  })

  it('maps justify shorthand with value transforms', () => {
    expect(normalizeStyle({ justify: 'start' })).toEqual({ justifyContent: 'flex-start' })
    expect(normalizeStyle({ justify: 'end' })).toEqual({ justifyContent: 'flex-end' })
    expect(normalizeStyle({ justify: 'center' })).toEqual({ justifyContent: 'center' })
    expect(normalizeStyle({ justify: 'between' })).toEqual({ justifyContent: 'space-between' })
    expect(normalizeStyle({ justify: 'evenly' })).toEqual({ justifyContent: 'space-evenly' })
  })

  it('maps items shorthand with value transforms', () => {
    expect(normalizeStyle({ items: 'start' })).toEqual({ alignItems: 'flex-start' })
    expect(normalizeStyle({ items: 'end' })).toEqual({ alignItems: 'flex-end' })
    expect(normalizeStyle({ items: 'center' })).toEqual({ alignItems: 'center' })
    expect(normalizeStyle({ items: 'stretch' })).toEqual({ alignItems: 'stretch' })
  })

  it('passes through full property names unchanged', () => {
    expect(normalizeStyle({ width: 100, backgroundColor: '#FFF' })).toEqual({
      width: 100,
      backgroundColor: '#FFF'
    })
  })

  it('full property takes precedence over shorthand', () => {
    expect(normalizeStyle({ w: 50, width: 100 })).toEqual({ width: 100 })
    expect(normalizeStyle({ bg: '#000', backgroundColor: '#FFF' })).toEqual({
      backgroundColor: '#FFF'
    })
  })

  it('handles complex combined styles', () => {
    const result = normalizeStyle({
      w: 200,
      h: 100,
      bg: '#3B82F6',
      rounded: 12,
      flex: 'col',
      justify: 'center',
      items: 'start',
      gap: 8,
      px: 16,
      py: 8
    })

    expect(result).toEqual({
      width: 200,
      height: 100,
      backgroundColor: '#3B82F6',
      borderRadius: 12,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 8,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8
    })
  })
})

describe('shorthands mapping', () => {
  it('contains expected keys', () => {
    expect(shorthands.w).toBe('width')
    expect(shorthands.h).toBe('height')
    expect(shorthands.bg).toBe('backgroundColor')
    expect(shorthands.rounded).toBe('borderRadius')
  })
})

describe('valueTransforms', () => {
  it('contains flexDirection transforms', () => {
    expect(valueTransforms.flexDirection.col).toBe('column')
  })

  it('contains justifyContent transforms', () => {
    expect(valueTransforms.justifyContent.start).toBe('flex-start')
    expect(valueTransforms.justifyContent.between).toBe('space-between')
  })
})
