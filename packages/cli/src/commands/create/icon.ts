import { defineCommand } from 'citty'
import { sendCommand, printResult, handleError } from '../../client.ts'
import { loadIconSvg } from '../../render/icon.ts'
import { fail } from '../../format.ts'
import { parseColorArg, colorArgToPayload } from '../../color-arg.ts'

export default defineCommand({
  meta: { description: 'Create an icon from Iconify' },
  args: {
    name: { type: 'positional', description: 'Icon name (e.g., mdi:home, lucide:star)', required: true },
    x: { type: 'string', description: 'X coordinate', default: '0' },
    y: { type: 'string', description: 'Y coordinate', default: '0' },
    size: { type: 'string', description: 'Size in pixels', default: '24' },
    color: { type: 'string', description: 'Icon color (hex or var:Name)' },
    parent: { type: 'string', description: 'Parent node ID' },
    component: { type: 'boolean', description: 'Create as Figma component' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const size = Number(args.size)
      const iconData = await loadIconSvg(args.name, size)
      
      if (!iconData) {
        console.error(fail(`Icon "${args.name}" not found`))
        process.exit(1)
      }

      const colorArg = parseColorArg(args.color)
      
      // Replace currentColor with hex (variable binding happens after import)
      let svg = iconData.svg
      svg = svg.replace(/currentColor/g, colorArg?.hex || '#000000')

      // Import SVG
      const result = await sendCommand('import-svg', {
        svg,
        x: Number(args.x),
        y: Number(args.y),
        parentId: args.parent
      }) as { id: string }

      // Rename to icon name
      const iconName = args.name.replace(':', '/')
      await sendCommand('rename-node', { id: result.id, name: iconName })

      // Bind variable to icon fills if specified
      if (colorArg?.variable) {
        await sendCommand('eval', {
          code: `
            const node = await figma.getNodeByIdAsync('${result.id}')
            if (!node || !('children' in node)) return null
            
            const variables = await figma.variables.getLocalVariablesAsync('COLOR')
            const variable = variables.find(v => v.name === '${colorArg.variable}')
            if (!variable) return null
            
            function bindFills(n) {
              if ('fills' in n && Array.isArray(n.fills) && n.fills.length > 0) {
                const fills = [...n.fills]
                for (let i = 0; i < fills.length; i++) {
                  if (fills[i].type === 'SOLID') {
                    fills[i] = figma.variables.setBoundVariableForPaint(fills[i], 'color', variable)
                  }
                }
                n.fills = fills
              }
              if ('children' in n) {
                for (const child of n.children) bindFills(child)
              }
            }
            bindFills(node)
            return true
          `
        })
      }

      // Convert to component if requested
      let finalId = result.id
      if (args.component) {
        const newId = await sendCommand('eval', {
          code: `
            const node = await figma.getNodeByIdAsync('${result.id}')
            if (node && 'createComponentFromNode' in figma) {
              return figma.createComponentFromNode(node).id
            }
            return null
          `
        }) as string | null
        if (newId) finalId = newId
      }

      // Get final result
      const finalResult = await sendCommand('get-node-info', { id: finalId })
      printResult(finalResult, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
