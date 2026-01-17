import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const CLI = 'bun run src/index.ts'
const cwd = import.meta.dir + '/..'

async function run(cmd: string): Promise<unknown> {
  const proc = Bun.spawn(['sh', '-c', `${CLI} ${cmd}`], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  await proc.exited
  if (proc.exitCode !== 0) throw new Error(stderr || stdout)
  try {
    return JSON.parse(stdout)
  } catch {
    return stdout.trim()
  }
}

describe('Figma Bridge CLI', () => {
  let testPageId: string
  let testFrameId: string
  const createdNodes: string[] = []

  beforeAll(async () => {
    const page = await run('create-page --name "Test Page" --json') as { id: string }
    testPageId = page.id
    await run(`set-current-page --id "${testPageId}" --json`)
    
    const frame = await run('create-frame --x 0 --y 0 --width 1200 --height 1000 --name "Test Frame" --json') as { id: string }
    testFrameId = frame.id
    createdNodes.push(testFrameId)
  })

  afterAll(async () => {
    if (testPageId) {
      const pages = await run('get-pages --json') as { id: string }[]
      const otherPage = pages.find(p => p.id !== testPageId)
      if (otherPage) {
        await run(`set-current-page --id "${otherPage.id}" --json`)
      }
      await run(`delete-node --id "${testPageId}" --json`)
    }
  })

  describe('status', () => {
    test('returns connected status', async () => {
      const result = await run('status --json') as string
      expect(result).toContain('connected')
    })
  })

  describe('pages', () => {
    test('get-pages returns array', async () => {
      const pages = await run('get-pages --json') as { id: string; name: string }[]
      expect(Array.isArray(pages)).toBe(true)
      expect(pages.length).toBeGreaterThan(0)
    })

    test('create-page creates new page', async () => {
      const page = await run('create-page --name "Temp Page" --json') as { id: string; name: string }
      expect(page.name).toBe('Temp Page')
      await run(`delete-node --id "${page.id}" --json`)
    })
  })

  describe('create-rectangle', () => {
    test('creates rectangle with basic params', async () => {
      const rect = await run(`create-rectangle --x 10 --y 10 --width 100 --height 50 --name "BasicRect" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.type).toBe('RECTANGLE')
      expect(rect.width).toBe(100)
      expect(rect.height).toBe(50)
    })

    test('creates rectangle with fill and radius', async () => {
      const rect = await run(`create-rectangle --x 120 --y 10 --width 100 --height 50 --fill "#FF0000" --radius 8 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.fills[0].color).toBe('#FF0000')
    })

    test('creates rectangle with stroke', async () => {
      const rect = await run(`create-rectangle --x 230 --y 10 --width 100 --height 50 --fill "#FFFFFF" --stroke "#000000" --strokeWeight 2 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.strokes[0].color).toBe('#000000')
      expect(rect.strokeWeight).toBe(2)
    })

    test('creates rectangle with opacity', async () => {
      const rect = await run(`create-rectangle --x 340 --y 10 --width 100 --height 50 --fill "#0000FF" --opacity 0.5 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.opacity).toBe(0.5)
    })

    test('creates rectangle with no stroke', async () => {
      const rect = await run(`create-rectangle --x 450 --y 10 --width 60 --height 60 --fill "#AAAAAA" --strokeWeight 0 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.strokeWeight).toBeFalsy()
    })
  })

  describe('create-ellipse', () => {
    test('creates ellipse with fill', async () => {
      const ellipse = await run(`create-ellipse --x 10 --y 80 --width 80 --height 80 --fill "#00FF00" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(ellipse.id)
      expect(ellipse.type).toBe('ELLIPSE')
      expect(ellipse.fills[0].color).toBe('#00FF00')
    })
  })

  describe('create-frame', () => {
    test('creates frame with layout', async () => {
      const frame = await run(`create-frame --x 10 --y 180 --width 300 --height 100 --fill "#EEEEEEEEE" --layoutMode HORIZONTAL --itemSpacing 10 --padding 16 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(frame.id)
      expect(frame.type).toBe('FRAME')
      expect(frame.layoutMode).toBe('HORIZONTAL')
      expect(frame.itemSpacing).toBe(10)
    })
  })

  describe('create-text', () => {
    test('creates text with basic params', async () => {
      const text = await run(`create-text --x 10 --y 300 --text "Hello World" --fontSize 24 --fill "#333333" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(text.id)
      expect(text.type).toBe('TEXT')
      expect(text.characters).toBe('Hello World')
      expect(text.fontSize).toBe(24)
    })

    test('creates text with bold font', async () => {
      const text = await run(`create-text --x 10 --y 340 --text "Bold Text" --fontSize 18 --fontStyle Bold --fill "#000000" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(text.id)
      expect(text.characters).toBe('Bold Text')
    })
  })

  describe('create-polygon', () => {
    test('creates hexagon', async () => {
      const poly = await run(`create-polygon --x 100 --y 80 --size 60 --sides 6 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(poly.id)
      expect(poly.type).toBe('POLYGON')
    })

    test('creates triangle', async () => {
      const poly = await run(`create-polygon --x 170 --y 80 --size 60 --sides 3 --name "Triangle" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(poly.id)
      expect(poly.type).toBe('POLYGON')
    })
  })

  describe('create-star', () => {
    test('creates star', async () => {
      const star = await run(`create-star --x 250 --y 80 --size 60 --points 5 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(star.id)
      expect(star.type).toBe('STAR')
    })
  })

  describe('create-line', () => {
    test('creates line', async () => {
      const line = await run(`create-line --x 330 --y 80 --length 80 --name "Line" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(line.id)
      expect(line.type).toBe('LINE')
    })

    test('creates line with rotation', async () => {
      const line = await run(`create-line --x 420 --y 80 --length 80 --rotation 45 --name "DiagonalLine" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(line.id)
      expect(line.type).toBe('LINE')
    })
  })

  describe('create-section', () => {
    test('creates section', async () => {
      const section = await run('create-section --x 1300 --y 0 --width 300 --height 400 --name "TestSection" --json') as any
      createdNodes.push(section.id)
      expect(section.type).toBe('SECTION')
    })
  })

  describe('create-slice', () => {
    test('creates slice', async () => {
      const slice = await run(`create-slice --x 520 --y 10 --width 100 --height 100 --name "ExportSlice" --json`) as any
      createdNodes.push(slice.id)
      expect(slice.type).toBe('SLICE')
    })
  })

  describe('node operations', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 600 --y 10 --width 80 --height 80 --fill "#AAAAAAAAA" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('get-node returns node info', async () => {
      const node = await run(`get-node --id "${nodeId}" --json`) as any
      expect(node.id).toBe(nodeId)
      expect(node.type).toBe('RECTANGLE')
    })

    test('move-node changes position', async () => {
      const moved = await run(`move-node --id "${nodeId}" --x 610 --y 20 --json`) as any
      expect(moved.x).toBe(610)
      expect(moved.y).toBe(20)
    })

    test('resize-node changes size', async () => {
      const resized = await run(`resize-node --id "${nodeId}" --width 100 --height 100 --json`) as any
      expect(resized.width).toBe(100)
      expect(resized.height).toBe(100)
    })

    test('rename-node changes name', async () => {
      const renamed = await run(`rename-node --id "${nodeId}" --name "RenamedRect" --json`) as any
      expect(renamed.name).toBe('RenamedRect')
    })

    test('set-fill-color changes fill', async () => {
      const filled = await run(`set-fill-color --id "${nodeId}" --color "#FF00FF" --json`) as any
      expect(filled.fills[0].color).toBe('#FF00FF')
    })

    test('set-opacity changes opacity', async () => {
      const result = await run(`set-opacity --id "${nodeId}" --opacity 0.7 --json`) as any
      expect(result.opacity).toBeCloseTo(0.7, 1)
    })

    test('set-visible hides node', async () => {
      const hidden = await run(`set-visible --id "${nodeId}" --visible false --json`) as any
      expect(hidden.visible).toBe(false)
      await run(`set-visible --id "${nodeId}" --visible true --json`)
    })

    test('set-corner-radius changes radius', async () => {
      const rounded = await run(`set-corner-radius --id "${nodeId}" --radius 16 --json`) as any
      expect(rounded.id).toBe(nodeId)
    })
  })

  describe('set-effect', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 600 --y 130 --width 100 --height 100 --fill "#FFFFFF" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('adds drop shadow', async () => {
      const result = await run(`set-effect --id "${nodeId}" --type DROP_SHADOW --color "#00000040" --offsetY 4 --radius 8 --json`) as any
      expect(result.id).toBe(nodeId)
    })
  })

  describe('set-text', () => {
    let textId: string

    beforeAll(async () => {
      const text = await run(`create-text --x 600 --y 250 --text "Original" --fontSize 16 --parentId "${testFrameId}" --json`) as any
      textId = text.id
      createdNodes.push(textId)
    })

    test('changes text content', async () => {
      const result = await run(`set-text --id "${textId}" --text "Updated" --json`) as any
      expect(result.characters).toBe('Updated')
    })
  })

  describe('set-font', () => {
    let textId: string

    beforeAll(async () => {
      const text = await run(`create-text --x 600 --y 290 --text "Font Test" --fontSize 16 --parentId "${testFrameId}" --json`) as any
      textId = text.id
      createdNodes.push(textId)
    })

    test('changes font family and style', async () => {
      const result = await run(`set-font --id "${textId}" --fontFamily "Inter" --fontStyle "Bold" --fontSize 20 --json`) as any
      expect(result.fontSize).toBe(20)
    })
  })

  describe('clone-node', () => {
    test('clones a node', async () => {
      const original = await run(`create-rectangle --x 600 --y 330 --width 50 --height 50 --fill "#FFFF00" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(original.id)
      
      const clone = await run(`clone-node --id "${original.id}" --json`) as any
      createdNodes.push(clone.id)
      expect(clone.type).toBe('RECTANGLE')
      expect(clone.id).not.toBe(original.id)
    })
  })

  describe('import-svg', () => {
    test('imports SVG', async () => {
      const svg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="red"/></svg>'
      const result = await run(`import-svg --svg '${svg}' --x 600 --y 400 --name "SVG Icon" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(result.id)
      expect(result.type).toBe('FRAME')
      expect(result.name).toBe('SVG Icon')
    })
  })

  describe('get-children', () => {
    let parentId: string

    beforeAll(async () => {
      const parent = await run(`create-frame --x 720 --y 10 --width 200 --height 150 --name "ChildrenParent" --parentId "${testFrameId}" --json`) as any
      parentId = parent.id
      createdNodes.push(parentId)
      
      await run(`create-rectangle --x 10 --y 10 --width 50 --height 50 --fill "#FF0000" --parentId "${parentId}" --json`)
      await run(`create-rectangle --x 70 --y 10 --width 50 --height 50 --fill "#00FF00" --parentId "${parentId}" --json`)
    })

    test('returns children of a frame', async () => {
      const children = await run(`get-children --id "${parentId}" --json`) as any[]
      expect(Array.isArray(children)).toBe(true)
      expect(children.length).toBe(2)
      expect(children[0].type).toBe('RECTANGLE')
    })
  })

  describe('find-by-name', () => {
    beforeAll(async () => {
      await run(`create-rectangle --x 720 --y 180 --width 60 --height 60 --fill "#800080" --name "Searchable" --parentId "${testFrameId}" --json`)
      await run(`create-rectangle --x 790 --y 180 --width 60 --height 60 --fill "#FFA500" --name "SearchableTwo" --parentId "${testFrameId}" --json`)
    })

    test('finds nodes by partial name', async () => {
      const results = await run('find-by-name --name "Searchable" --json') as any[]
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    test('finds nodes by exact name', async () => {
      const results = await run('find-by-name --name "Searchable" --exact --json') as any[]
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Searchable')
    })

    test('filters by type', async () => {
      const results = await run('find-by-name --name "Searchable" --type RECTANGLE --json') as any[]
      expect(results.every(r => r.type === 'RECTANGLE')).toBe(true)
    })
  })

  describe('select-nodes', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 720 --y 260 --width 60 --height 60 --fill "#00FFFF" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('selects nodes in UI', async () => {
      const result = await run(`select-nodes --ids "${nodeId}" --json`) as any
      expect(result.selected).toBe(1)
    })
  })

  describe('set-constraints', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 720 --y 340 --width 80 --height 80 --fill "#00FF00" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('sets constraints', async () => {
      const result = await run(`set-constraints --id "${nodeId}" --horizontal CENTER --vertical MAX --json`) as any
      expect(result.id).toBe(nodeId)
    })
  })

  describe('set-blend-mode', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 720 --y 440 --width 80 --height 80 --fill "#FFC0CB" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('sets blend mode', async () => {
      const result = await run(`set-blend-mode --id "${nodeId}" --mode MULTIPLY --json`) as any
      expect(result.id).toBe(nodeId)
    })
  })

  describe('set-auto-layout', () => {
    let frameId: string

    beforeAll(async () => {
      const frame = await run(`create-frame --x 720 --y 540 --width 200 --height 100 --fill "#EEEEEE" --parentId "${testFrameId}" --json`) as any
      frameId = frame.id
      createdNodes.push(frameId)
    })

    test('enables auto-layout with spacing', async () => {
      const result = await run(`set-auto-layout --id "${frameId}" --mode HORIZONTAL --itemSpacing 12 --padding "8,8,8,8" --json`) as any
      expect(result.layoutMode).toBe('HORIZONTAL')
      expect(result.itemSpacing).toBe(12)
    })

    test('sets alignment', async () => {
      const result = await run(`set-auto-layout --id "${frameId}" --primaryAlign CENTER --counterAlign CENTER --json`) as any
      expect(result.id).toBe(frameId)
    })
  })

  describe('group-nodes', () => {
    test('groups nodes together', async () => {
      const r1 = await run(`create-rectangle --x 860 --y 10 --width 40 --height 40 --fill "#FF0000" --parentId "${testFrameId}" --json`) as any
      const r2 = await run(`create-rectangle --x 910 --y 10 --width 40 --height 40 --fill "#00FF00" --parentId "${testFrameId}" --json`) as any
      
      const group = await run(`group-nodes --ids "${r1.id},${r2.id}" --name "TestGroup" --json`) as any
      createdNodes.push(group.id)
      expect(group.type).toBe('GROUP')
      expect(group.name).toBe('TestGroup')
    })
  })

  describe('boolean operations', () => {
    test('union-nodes combines shapes', async () => {
      const r1 = await run(`create-rectangle --x 860 --y 70 --width 60 --height 60 --fill "#0000FF" --parentId "${testFrameId}" --json`) as any
      const r2 = await run(`create-rectangle --x 890 --y 100 --width 60 --height 60 --fill "#0000FF" --parentId "${testFrameId}" --json`) as any
      
      const union = await run(`union-nodes --ids "${r1.id},${r2.id}" --json`) as any
      createdNodes.push(union.id)
      expect(union.type).toBe('BOOLEAN_OPERATION')
    })
  })

  describe('viewport', () => {
    test('get-viewport returns viewport info', async () => {
      const vp = await run('get-viewport --json') as any
      expect(vp).toHaveProperty('center')
      expect(vp).toHaveProperty('zoom')
    })

    test('zoom-to-fit zooms to nodes', async () => {
      const result = await run(`zoom-to-fit --ids "${testFrameId}" --json`) as any
      expect(result).toHaveProperty('center')
      expect(result).toHaveProperty('zoom')
    })
  })

  describe('styles', () => {
    test('create-paint-style creates color style', async () => {
      const style = await run('create-paint-style --name "Test/Primary" --color "#E11D48" --json') as any
      expect(style.name).toBe('Test/Primary')
    })

    test('create-text-style creates text style', async () => {
      const style = await run('create-text-style --name "Test/Body" --fontFamily "Inter" --fontStyle "Regular" --fontSize 16 --json') as any
      expect(style.name).toBe('Test/Body')
    })

    test('create-effect-style creates effect style', async () => {
      const style = await run('create-effect-style --name "Test/Shadow" --type DROP_SHADOW --color "#00000020" --offsetY 2 --radius 4 --json') as any
      expect(style.name).toBe('Test/Shadow')
    })

    test('get-local-styles returns styles', async () => {
      const styles = await run('get-local-styles --type paint --json') as any
      expect(styles).toHaveProperty('paintStyles')
    })
  })

  describe('export', () => {
    test('export-node exports as PNG', async () => {
      const rect = await run(`create-rectangle --x 970 --y 10 --width 100 --height 100 --fill "#00FFFF" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      
      const result = await run(`export-node --id "${rect.id}" --format PNG --scale 1 --json`) as any
      expect(result).toHaveProperty('data')
      expect(result.data.length).toBeGreaterThan(0)
    })

    test('export-node exports as SVG', async () => {
      const rect = await run(`create-rectangle --x 1080 --y 10 --width 60 --height 60 --fill "#FF0000" --radius 8 --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      
      const result = await run(`export-node --id "${rect.id}" --format SVG --json`) as any
      expect(atob(result.data)).toContain('svg')
    })
  })

  describe('screenshot', () => {
    test('takes screenshot', async () => {
      const result = await run('screenshot --output /tmp/test-screenshot.png --json')
      expect(result).toBe('/tmp/test-screenshot.png')
    })
  })

  describe('delete-node', () => {
    test('deletes a node', async () => {
      const rect = await run(`create-rectangle --x 970 --y 130 --width 50 --height 50 --parentId "${testFrameId}" --json`) as any
      const result = await run(`delete-node --id "${rect.id}" --json`) as any
      expect(result.deleted).toBe(true)
    })
  })

  describe('set-layout-child', () => {
    let frameId: string
    let childId: string

    beforeAll(async () => {
      const frame = await run(`create-frame --x 1000 --y 10 --width 300 --height 80 --fill "#F5F5F5" --layoutMode HORIZONTAL --itemSpacing 8 --parentId "${testFrameId}" --json`) as any
      frameId = frame.id
      createdNodes.push(frameId)

      const child = await run(`create-rectangle --x 0 --y 0 --width 60 --height 40 --fill "#E11D48" --parentId "${frameId}" --json`) as any
      childId = child.id
    })

    test('sets horizontal sizing to FILL', async () => {
      const result = await run(`set-layout-child --id "${childId}" --horizontalSizing FILL --json`) as any
      expect(result.id).toBe(childId)
    })

    test('sets vertical sizing to FIXED', async () => {
      const result = await run(`set-layout-child --id "${childId}" --verticalSizing FIXED --json`) as any
      expect(result.id).toBe(childId)
    })
  })

  describe('set-text-properties', () => {
    let textId: string

    beforeAll(async () => {
      const text = await run(`create-text --x 1000 --y 110 --text "Typography test" --fontSize 16 --fill "#333333" --parentId "${testFrameId}" --json`) as any
      textId = text.id
      createdNodes.push(textId)
    })

    test('sets line height', async () => {
      const result = await run(`set-text-properties --id "${textId}" --lineHeight 24 --json`) as any
      expect(result.id).toBe(textId)
    })

    test('sets letter spacing', async () => {
      const result = await run(`set-text-properties --id "${textId}" --letterSpacing 1 --json`) as any
      expect(result.id).toBe(textId)
    })

    test('sets text alignment', async () => {
      const result = await run(`set-text-properties --id "${textId}" --textAlign CENTER --json`) as any
      expect(result.id).toBe(textId)
    })

    test('sets auto resize mode', async () => {
      const result = await run(`set-text-properties --id "${textId}" --autoResize HEIGHT --json`) as any
      expect(result.id).toBe(textId)
    })
  })

  describe('set-min-max', () => {
    let frameId: string

    beforeAll(async () => {
      const frame = await run(`create-frame --x 1000 --y 160 --width 200 --height 100 --fill "#EEEEEE" --layoutMode VERTICAL --parentId "${testFrameId}" --json`) as any
      frameId = frame.id
      createdNodes.push(frameId)
    })

    test('sets min width', async () => {
      const result = await run(`set-min-max --id "${frameId}" --minWidth 100 --json`) as any
      expect(result.id).toBe(frameId)
    })

    test('sets max width', async () => {
      const result = await run(`set-min-max --id "${frameId}" --maxWidth 400 --json`) as any
      expect(result.id).toBe(frameId)
    })

    test('sets min and max height', async () => {
      const result = await run(`set-min-max --id "${frameId}" --minHeight 50 --maxHeight 300 --json`) as any
      expect(result.id).toBe(frameId)
    })
  })

  describe('set-rotation', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 1000 --y 280 --width 60 --height 60 --fill "#10B981" --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('rotates node', async () => {
      const result = await run(`set-rotation --id "${nodeId}" --angle 45 --json`) as any
      expect(result.id).toBe(nodeId)
    })

    test('rotates to negative angle', async () => {
      const result = await run(`set-rotation --id "${nodeId}" --angle -30 --json`) as any
      expect(result.id).toBe(nodeId)
    })
  })

  describe('set-stroke-align', () => {
    let nodeId: string

    beforeAll(async () => {
      const rect = await run(`create-rectangle --x 1080 --y 280 --width 60 --height 60 --fill "#FFFFFF" --stroke "#000000" --strokeWeight 4 --parentId "${testFrameId}" --json`) as any
      nodeId = rect.id
      createdNodes.push(nodeId)
    })

    test('sets stroke align to INSIDE', async () => {
      const result = await run(`set-stroke-align --id "${nodeId}" --align INSIDE --json`) as any
      expect(result.id).toBe(nodeId)
    })

    test('sets stroke align to OUTSIDE', async () => {
      const result = await run(`set-stroke-align --id "${nodeId}" --align OUTSIDE --json`) as any
      expect(result.id).toBe(nodeId)
    })
  })

  describe('short hex colors', () => {
    test('supports 3-char hex in rectangle', async () => {
      const rect = await run(`create-rectangle --x 1000 --y 360 --width 50 --height 50 --fill "#F00" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      expect(rect.fills[0].color).toBe('#FF0000')
    })

    test('supports 3-char hex in text', async () => {
      const text = await run(`create-text --x 1060 --y 360 --text "Short hex" --fontSize 14 --fill "#333" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(text.id)
      expect(text.fills[0].color).toBe('#333333')
    })
  })

  describe('individual corner radius', () => {
    test('sets different corner radii', async () => {
      const rect = await run(`create-rectangle --x 1000 --y 420 --width 80 --height 80 --fill "#8B5CF6" --parentId "${testFrameId}" --json`) as any
      createdNodes.push(rect.id)
      
      const result = await run(`set-corner-radius --id "${rect.id}" --radius 0 --topLeft 16 --bottomRight 16 --json`) as any
      expect(result.id).toBe(rect.id)
    })
  })

  describe('eval', () => {
    test('executes code and returns result', async () => {
      const result = await run(`eval "return 2 + 2" --json`)
      expect(result).toBe(4)
    })

    test('accesses figma API', async () => {
      const result = await run(`eval "return figma.currentPage.name" --json`) as string
      expect(typeof result).toBe('string')
    })

    test('creates nodes via eval', async () => {
      const result = await run(`eval "const r = figma.createRectangle(); r.name = 'EvalRect'; r.resize(50, 50); return {id: r.id, name: r.name}" --json`) as any
      createdNodes.push(result.id)
      expect(result.name).toBe('EvalRect')
    })

    test('runs async code', async () => {
      const result = await run(`eval "const pages = await figma.root.children; return pages.length" --json`) as number
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('timeout', () => {
    test('short timeout triggers error on slow operation', async () => {
      // 1 sec timeout, 2 sec sleep - should timeout
      await expect(
        run(`eval "await new Promise(r => setTimeout(r, 2000)); return 'done'" --timeout 1 --json`)
      ).rejects.toThrow('timeout')
    })

    test('long timeout allows slow operation to complete', async () => {
      // 3 sec timeout, 1 sec sleep - should complete
      const result = await run(`eval "await new Promise(r => setTimeout(r, 1000)); return 'done'" --timeout 3 --json`)
      expect(result).toBe('done')
    })
  })
})
