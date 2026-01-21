import { describe, test, expect } from 'bun:test'

import { parseColor, colorToFill, rgbaToHex } from '../src/color.ts'

describe('color', () => {
  test('parseColor parses hex colors', () => {
    expect(parseColor('#FF0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(parseColor('#00FF00')).toEqual({ r: 0, g: 1, b: 0, a: 1 })
    expect(parseColor('#0000FF')).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    expect(parseColor('#ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('parseColor parses short hex', () => {
    const red = parseColor('#f00')
    expect(red.r).toBeCloseTo(1, 2)
    expect(red.g).toBeCloseTo(0, 2)
    expect(red.b).toBeCloseTo(0, 2)
  })

  test('parseColor parses hex with alpha', () => {
    const c = parseColor('#FF000080')
    expect(c.r).toBeCloseTo(1, 2)
    expect(c.a).toBeCloseTo(0.5, 1)
  })

  test('parseColor parses rgb()', () => {
    const c = parseColor('rgb(255, 128, 0)')
    expect(c.r).toBeCloseTo(1, 2)
    expect(c.g).toBeCloseTo(0.5, 1)
    expect(c.b).toBeCloseTo(0, 2)
    expect(c.a).toBe(1)
  })

  test('parseColor parses rgba()', () => {
    const c = parseColor('rgba(255, 0, 0, 0.5)')
    expect(c.r).toBeCloseTo(1, 2)
    expect(c.a).toBeCloseTo(0.5, 2)
  })

  test('parseColor parses named colors', () => {
    const red = parseColor('red')
    expect(red.r).toBeCloseTo(1, 2)
    expect(red.g).toBeCloseTo(0, 2)
    expect(red.b).toBeCloseTo(0, 2)

    const white = parseColor('white')
    expect(white.r).toBeCloseTo(1, 2)
    expect(white.g).toBeCloseTo(1, 2)
    expect(white.b).toBeCloseTo(1, 2)
  })

  test('parseColor parses hsl()', () => {
    const c = parseColor('hsl(0, 100%, 50%)')
    expect(c.r).toBeCloseTo(1, 1)
    expect(c.g).toBeCloseTo(0, 1)
    expect(c.b).toBeCloseTo(0, 1)
  })

  test('parseColor returns black for invalid', () => {
    expect(parseColor('invalid')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('colorToFill creates Figma fill', () => {
    const fill = colorToFill('#FF0000')
    expect(fill.type).toBe('SOLID')
    expect(fill.color.r).toBe(1)
    expect(fill.color.g).toBe(0)
    expect(fill.color.b).toBe(0)
    expect(fill.visible).toBe(true)
  })

  test('rgbaToHex converts to hex', () => {
    expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000')
    expect(rgbaToHex({ r: 0, g: 1, b: 0, a: 1 })).toBe('#00FF00')
    expect(rgbaToHex({ r: 0, g: 0, b: 1, a: 1 })).toBe('#0000FF')
  })
})
