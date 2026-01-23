import { describe, test, expect } from 'bun:test'

import { createLinter, type FigmaNode } from '../src/index.ts'

describe('Linter', () => {
  test('detects hardcoded colors', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Box',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
      }
    ]

    const linter = createLinter({ rules: ['no-hardcoded-colors'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].ruleId).toBe('no-hardcoded-colors')
  })

  test('ignores colors bound to variables', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Box',
        type: 'RECTANGLE',
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0 },
            boundVariables: { color: { id: 'var:123' } }
          }
        ]
      }
    ]

    const linter = createLinter({ rules: ['no-hardcoded-colors'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(0)
  })

  test('detects default names', () => {
    const nodes: FigmaNode[] = [
      { id: '1:1', name: 'Frame 42', type: 'FRAME', width: 100, height: 100 },
      { id: '1:2', name: 'header-card', type: 'FRAME', width: 100, height: 100 }
    ]

    const linter = createLinter({ rules: ['no-default-names'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].nodeId).toBe('1:1')
  })

  test('detects missing auto layout', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Card',
        type: 'FRAME',
        layoutMode: 'NONE',
        children: [
          { id: '1:2', name: 'Title', type: 'TEXT', x: 0, y: 0, width: 100, height: 20 },
          { id: '1:3', name: 'Body', type: 'TEXT', x: 0, y: 30, width: 100, height: 50 }
        ]
      }
    ]

    const linter = createLinter({ rules: ['prefer-auto-layout'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].ruleId).toBe('prefer-auto-layout')
  })

  test('detects inconsistent spacing', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Card',
        type: 'FRAME',
        layoutMode: 'VERTICAL',
        itemSpacing: 13, // Not in 8pt grid
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16
      }
    ]

    const linter = createLinter({ rules: ['consistent-spacing'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].message).toContain('13px')
  })

  test('detects low contrast', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Container',
        type: 'FRAME',
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], // White bg
        children: [
          {
            id: '1:2',
            name: 'Text',
            type: 'TEXT',
            characters: 'Light gray text',
            fontSize: 14,
            fills: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }] // Light gray
          }
        ]
      }
    ]

    const linter = createLinter({ rules: ['color-contrast'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].ruleId).toBe('color-contrast')
  })

  test('detects small touch targets', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'small-button',
        type: 'COMPONENT',
        width: 32,
        height: 32
      }
    ]

    const linter = createLinter({ rules: ['touch-target-size'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].message).toContain('32px')
  })

  test('detects hidden layers', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'hidden-stuff',
        type: 'FRAME',
        visible: false
      }
    ]

    const linter = createLinter({ rules: ['no-hidden-layers'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
  })

  test('detects subpixel values', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Box',
        type: 'RECTANGLE',
        x: 10.5,
        y: 20.3,
        width: 100,
        height: 50
      }
    ]

    const linter = createLinter({ rules: ['pixel-perfect'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].message).toContain('10.5')
  })

  test('preset recommended includes core rules', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Frame 1',
        type: 'FRAME',
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
      }
    ]

    const linter = createLinter({ preset: 'recommended' })
    const result = linter.lint(nodes)

    // Should catch both hardcoded color and default name
    expect(result.messages.length).toBeGreaterThanOrEqual(2)
  })

  test('counts errors, warnings, and info correctly', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Container',
        type: 'FRAME',
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        children: [
          {
            id: '1:2',
            name: 'Text',
            type: 'TEXT',
            characters: 'Bad contrast',
            fontSize: 14,
            fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }]
          }
        ]
      }
    ]

    const linter = createLinter({ preset: 'recommended' })
    const result = linter.lint(nodes)

    expect(result.errorCount + result.warningCount + result.infoCount).toBe(result.messages.length)
  })

  test('detects groups', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'My Group',
        type: 'GROUP',
        children: [{ id: '1:2', name: 'Child', type: 'RECTANGLE' }]
      }
    ]

    const linter = createLinter({ rules: ['no-groups'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].ruleId).toBe('no-groups')
  })

  test('detects effects without styles', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Card',
        type: 'FRAME',
        effects: [{ type: 'DROP_SHADOW', visible: true, radius: 10 }]
      }
    ]

    const linter = createLinter({ rules: ['effect-style-required'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].message).toContain('Drop shadow')
  })

  test('detects mixed text styles', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Mixed Text',
        type: 'TEXT',
        characters: 'Hello World with different styles'
        // fontSize is undefined when mixed
      }
    ]

    const linter = createLinter({ rules: ['no-mixed-styles'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].ruleId).toBe('no-mixed-styles')
  })

  test('detects potential detached instances', () => {
    const nodes: FigmaNode[] = [
      {
        id: '1:1',
        name: 'Button Primary',
        type: 'FRAME',
        layoutMode: 'HORIZONTAL',
        children: [{ id: '1:2', name: 'Label', type: 'TEXT', characters: 'Click me' }]
      }
    ]

    const linter = createLinter({ rules: ['no-detached-instances'] })
    const result = linter.lint(nodes)

    expect(result.messages.length).toBe(1)
    expect(result.messages[0].message).toContain('Button Primary')
  })
})
