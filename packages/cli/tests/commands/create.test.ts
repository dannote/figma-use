import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

import { run, trackNode, setupTestPage, teardownTestPage } from '../helpers.ts'

import type { NodeRef } from '../../src/types.ts'

describe('create', () => {
  let testFrameId: string

  beforeAll(async () => {
    await setupTestPage('create')
    const frame = (await run(
      'create frame --x 0 --y 0 --width 800 --height 600 --name "Create Tests" --json'
    )) as { id: string }
    testFrameId = frame.id
    trackNode(testFrameId)
  })

  afterAll(async () => {
    await teardownTestPage()
  })

  describe('rect', () => {
    test('creates rectangle with basic params', async () => {
      const rect = (await run(
        `create rect --x 10 --y 10 --width 100 --height 50 --name "BasicRect" --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.type).toBe('RECTANGLE')
      expect(rect.width).toBe(100)
      expect(rect.height).toBe(50)
    })

    test('creates rectangle with fill and radius', async () => {
      const rect = (await run(
        `create rect --x 120 --y 10 --width 100 --height 50 --fill "#FF0000" --radius 8 --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.fills[0]!.color).toBe('#FF0000')
    })

    test('creates rectangle with variable fill', async () => {
      // Create variable
      const collection = (await run('collection create "RectTestColors" --json')) as any
      const variable = (await run(
        `variable create "Primary" --collection "${collection.id}" --type COLOR --value "#3B82F6" --json`
      )) as any

      const rect = (await run(
        `create rect --x 560 --y 10 --width 50 --height 50 --fill "var:Primary" --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.fills[0]!.color).toBe('#3B82F6')

      // Cleanup
      await run(`variable delete "${variable.id}" --json`)
      await run(`collection delete "${collection.id}" --json`)
    })

    test('creates rectangle with stroke', async () => {
      const rect = (await run(
        `create rect --x 230 --y 10 --width 100 --height 50 --fill "#FFFFFF" --stroke "#000000" --strokeWeight 2 --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.strokes[0]!.color).toBe('#000000')
      expect(rect.strokeWeight).toBe(2)
    })

    test('creates rectangle with opacity', async () => {
      const rect = (await run(
        `create rect --x 340 --y 10 --width 100 --height 50 --fill "#0000FF" --opacity 0.5 --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.opacity).toBe(0.5)
    })

    test('supports 3-char hex colors', async () => {
      const rect = (await run(
        `create rect --x 450 --y 10 --width 50 --height 50 --fill "#F00" --parent "${testFrameId}" --json`
      )) as any
      trackNode(rect.id)
      expect(rect.fills[0]!.color).toBe('#FF0000')
    })
  })

  describe('ellipse', () => {
    test('creates ellipse with fill', async () => {
      const ellipse = (await run(
        `create ellipse --x 10 --y 80 --width 80 --height 80 --fill "#00FF00" --parent "${testFrameId}" --json`
      )) as any
      trackNode(ellipse.id)
      expect(ellipse.type).toBe('ELLIPSE')
      expect(ellipse.fills[0]!.color).toBe('#00FF00')
    })
  })

  describe('line', () => {
    test('creates line', async () => {
      const line = (await run(
        `create line --x 100 --y 80 --length 80 --name "Line" --parent "${testFrameId}" --json`
      )) as any
      trackNode(line.id)
      expect(line.type).toBe('LINE')
    })
  })

  describe('polygon', () => {
    test('creates hexagon', async () => {
      const poly = (await run(
        `create polygon --x 200 --y 80 --size 80 --sides 6 --parent "${testFrameId}" --json`
      )) as any
      trackNode(poly.id)
      expect(poly.type).toBe('POLYGON')
    })

    test('creates triangle', async () => {
      const poly = (await run(
        `create polygon --x 290 --y 80 --size 80 --sides 3 --name "Triangle" --parent "${testFrameId}" --json`
      )) as any
      trackNode(poly.id)
      expect(poly.type).toBe('POLYGON')
    })
  })

  describe('star', () => {
    test('creates star', async () => {
      const star = (await run(
        `create star --x 380 --y 80 --size 80 --points 5 --parent "${testFrameId}" --json`
      )) as any
      trackNode(star.id)
      expect(star.type).toBe('STAR')
    })
  })

  describe('frame', () => {
    test('creates frame with layout', async () => {
      const frame = (await run(
        `create frame --x 10 --y 180 --width 300 --height 100 --fill "#EEEEEE" --layout HORIZONTAL --gap 10 --padding 16 --parent "${testFrameId}" --json`
      )) as any
      trackNode(frame.id)
      expect(frame.type).toBe('FRAME')
      expect(frame.layoutMode).toBe('HORIZONTAL')
      expect(frame.itemSpacing).toBe(10)
    })
  })

  describe('text', () => {
    test('creates text with basic params', async () => {
      const text = (await run(
        `create text --x 10 --y 300 --text "Hello World" --fontSize 24 --fill "#333333" --parent "${testFrameId}" --json`
      )) as any
      trackNode(text.id)
      expect(text.type).toBe('TEXT')
      expect(text.characters).toBe('Hello World')
      expect(text.fontSize).toBe(24)
    })

    test('creates text with bold font', async () => {
      const text = (await run(
        `create text --x 10 --y 340 --text "Bold Text" --fontSize 18 --fontStyle Bold --fill "#000000" --parent "${testFrameId}" --json`
      )) as any
      trackNode(text.id)
      expect(text.characters).toBe('Bold Text')
    })
  })

  describe('component', () => {
    test('creates component', async () => {
      const comp = (await run(
        `create component --x 10 --y 400 --width 100 --height 50 --name "Button" --parent "${testFrameId}" --json`
      )) as any
      trackNode(comp.id)
      expect(comp.type).toBe('COMPONENT')
    })
  })

  describe('section', () => {
    test('creates section', async () => {
      const section = (await run(
        'create section --x 900 --y 0 --width 300 --height 400 --name "TestSection" --json'
      )) as any
      trackNode(section.id)
      expect(section.type).toBe('SECTION')
    })
  })

  describe('slice', () => {
    test('creates slice', async () => {
      const slice = (await run(
        `create slice --x 520 --y 10 --width 100 --height 100 --name "ExportSlice" --json`
      )) as any
      trackNode(slice.id)
      expect(slice.type).toBe('SLICE')
    })
  })

  describe('page', () => {
    test('creates new page', async () => {
      const page = (await run('create page "Temp Page" --json')) as NodeRef
      expect(page.name).toBe('Temp Page')
      await run(`node delete ${page.id} --json`)
    })
  })

  describe('icon', () => {
    test('creates icon from Iconify', async () => {
      const icon = (await run(
        `create icon mdi:home --size 24 --parent "${testFrameId}" --json`
      )) as any
      trackNode(icon.id)
      expect(icon.type).toBe('FRAME')
      expect(icon.name).toBe('mdi/home')
      expect(icon.width).toBe(24)
      expect(icon.height).toBe(24)
    })

    test('creates icon with custom color', async () => {
      const icon = (await run(
        `create icon mdi:star --size 32 --color "#E11D48" --parent "${testFrameId}" --json`
      )) as any
      trackNode(icon.id)
      expect(icon.width).toBe(32)
    })

    test('creates icon as component', async () => {
      const icon = (await run(
        `create icon lucide:heart --component --parent "${testFrameId}" --json`
      )) as any
      trackNode(icon.id)
      expect(icon.type).toBe('COMPONENT')
      expect(icon.name).toBe('lucide/heart')
    })
  })
})
