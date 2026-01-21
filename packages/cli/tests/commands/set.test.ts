import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

describe('set', () => {
  let rectId: string
  let textId: string

  beforeAll(async () => {
    await setupTestPage('set')
    const rect = (await run(
      'create rect --x 0 --y 0 --width 100 --height 100 --fill "#FFFFFF" --json'
    )) as any
    rectId = rect.id
    trackNode(rectId)

    const text = (await run('create text --x 0 --y 150 --text "Test" --fontSize 16 --json')) as any
    textId = text.id
    trackNode(textId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  describe('fill', () => {
    test('changes fill color', async () => {
      const result = (await run(`set fill ${rectId} "#FF0000" --json`)) as any
      expect(result.fills[0]!.color).toBe('#FF0000')
    })

    test('binds fill to variable with var: syntax', async () => {
      // Create a variable first
      const collection = (await run('collection create "TestColors" --json')) as any
      const variable = (await run(
        `variable create "TestPrimary" --collection "${collection.id}" --type COLOR --value "#3B82F6" --json`
      )) as any

      const result = (await run(`set fill ${rectId} "var:TestPrimary" --json`)) as any
      expect(result.fills[0]!.color).toBe('#3B82F6')

      // Verify variable is bound
      const info = (await run(
        `eval "const n = await figma.getNodeByIdAsync('${rectId}'); return n.fills[0].boundVariables?.color?.id"`
      )) as string
      expect(info).toBe(variable.id)

      // Cleanup
      await run(`variable delete "${variable.id}" --json`)
      await run(`collection delete "${collection.id}" --json`)
    })

    test('binds fill to variable with $ syntax', async () => {
      const collection = (await run('collection create "TestColors2" --json')) as any
      const variable = (await run(
        `variable create "Accent" --collection "${collection.id}" --type COLOR --value "#E11D48" --json`
      )) as any

      const result = (await run(`set fill ${rectId} '$Accent' --json`)) as any
      expect(result.fills[0]!.color).toBe('#E11D48')

      // Cleanup
      await run(`variable delete "${variable.id}" --json`)
      await run(`collection delete "${collection.id}" --json`)
    })
  })

  describe('stroke', () => {
    test('changes stroke color and weight', async () => {
      const result = (await run(`set stroke ${rectId} "#0000FF" --weight 2 --json`)) as any
      expect(result.strokes[0]!.color).toBe('#0000FF')
      expect(result.strokeWeight).toBe(2)
    })
  })

  describe('radius', () => {
    test('changes corner radius', async () => {
      // Create rect with radius to test
      const rect = (await run(
        'create rect --x 200 --y 0 --width 50 --height 50 --radius 8 --json'
      )) as any
      trackNode(rect.id)
      expect(rect.cornerRadius).toBe(8)
    })
  })

  describe('opacity', () => {
    test('changes opacity', async () => {
      const result = (await run(`set opacity ${rectId} 0.5 --json`)) as any
      expect(result.opacity).toBe(0.5)
    })
  })

  describe('rotation', () => {
    test('changes rotation', async () => {
      await run(`set rotation ${rectId} --angle 45 --json`)
      // Reset to 0 for other tests
      await run(`set rotation ${rectId} --angle 0 --json`)
    })
  })

  describe('visible', () => {
    test('hides node', async () => {
      const result = (await run(`set visible ${rectId} false --json`)) as any
      expect(result.visible).toBe(false)
    })

    test('shows node', async () => {
      const result = (await run(`set visible ${rectId} true --json`)) as any
      // visible: true is default and not returned
      expect(result.visible).toBeUndefined()
    })
  })

  describe('locked', () => {
    test('locks node', async () => {
      const result = (await run(`set locked ${rectId} true --json`)) as any
      expect(result.locked).toBe(true)
    })

    test('unlocks node', async () => {
      const result = (await run(`set locked ${rectId} false --json`)) as any
      // locked: false is default and not returned
      expect(result.locked).toBeUndefined()
    })
  })

  describe('text', () => {
    test('changes text content', async () => {
      const result = (await run(`set text ${textId} "New Text" --json`)) as any
      expect(result.characters).toBe('New Text')
    })
  })

  describe('font-range', () => {
    test('changes font style for range', async () => {
      // Set text to known value first
      await run(`set text ${textId} "Hello World" --json`)
      const result = (await run(
        `set font-range ${textId} --start 0 --end 5 --style Bold --json`
      )) as any
      expect(result.characters).toBe('Hello World')
    })

    test('changes color for range', async () => {
      const result = (await run(
        `set font-range ${textId} --start 6 --end 11 --color "#FF0000" --json`
      )) as any
      expect(result.characters).toBe('Hello World')
    })

    test('changes font size for range', async () => {
      const result = (await run(
        `set font-range ${textId} --start 0 --end 5 --size 24 --json`
      )) as any
      expect(result.characters).toBe('Hello World')
    })
  })
})

describe('set layout', () => {
  let layoutTestId: string

  beforeAll(async () => {
    const frame = (await run(
      'create frame --x 500 --y 0 --width 400 --height 300 --fill "#FFFFFF" --json'
    )) as any
    layoutTestId = frame.id
    trackNode(layoutTestId)
  })

  test('sets layout mode to GRID', async () => {
    const result = (await run(`set layout ${layoutTestId} --mode GRID --json`)) as any
    expect(result.layoutMode).toBe('GRID')
  })

  test('sets grid column gap', async () => {
    const result = (await run(`set layout ${layoutTestId} --col-gap 20 --json`)) as any
    expect(result.gridColumnGap).toBe(20)
  })

  test('sets grid row gap', async () => {
    const result = (await run(`set layout ${layoutTestId} --row-gap 16 --json`)) as any
    expect(result.gridRowGap).toBe(16)
  })

  test('sets grid template columns', async () => {
    const result = (await run(`set layout ${layoutTestId} --cols "100px 1fr 100px" --json`)) as any
    expect(result.gridColumnSizes).toHaveLength(3)
    expect(result.gridColumnSizes[0].type).toBe('FIXED')
    expect(result.gridColumnSizes[0].value).toBe(100)
    expect(result.gridColumnSizes[1].type).toBe('FLEX')
    expect(result.gridColumnSizes[2].type).toBe('FIXED')
  })

  test('sets grid template rows', async () => {
    const result = (await run(`set layout ${layoutTestId} --rows "auto auto" --json`)) as any
    expect(result.gridRowSizes).toHaveLength(2)
  })

  test('sets all grid properties at once', async () => {
    const result = (await run(
      `set layout ${layoutTestId} --mode GRID --cols "1fr 1fr" --rows "auto" --col-gap 24 --row-gap 12 --json`
    )) as any
    expect(result.layoutMode).toBe('GRID')
    expect(result.gridColumnSizes).toHaveLength(2)
    expect(result.gridRowSizes).toHaveLength(1)
    expect(result.gridColumnGap).toBe(24)
    expect(result.gridRowGap).toBe(12)
  })
})
