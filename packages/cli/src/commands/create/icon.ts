import { defineCommand } from 'citty'

import { sendCommand, printResult, handleError } from '../../client.ts'
import { fail } from '../../format.ts'
import { loadIconSvg } from '../../render/icon.ts'

const VAR_PREFIX_RE = /^(?:var:|[$])(.+)$/

/**
 * Replace currentColor in SVG fill/stroke attributes using HTMLRewriter
 */
async function replaceSvgCurrentColor(svg: string, color: string): Promise<string> {
  const rewriter = new HTMLRewriter().on('*', {
    element(el) {
      if (el.getAttribute('fill') === 'currentColor') {
        el.setAttribute('fill', color)
      }
      if (el.getAttribute('stroke') === 'currentColor') {
        el.setAttribute('stroke', color)
      }
    }
  })

  return await rewriter.transform(new Response(svg)).text()
}

export default defineCommand({
  meta: { description: 'Create an icon from Iconify' },
  args: {
    name: {
      type: 'positional',
      description: 'Icon name (e.g., mdi:home, lucide:star)',
      required: true
    },
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

      // Check if color is a variable reference
      const varMatch = args.color?.match(VAR_PREFIX_RE)
      const hexColor = varMatch ? '#000000' : args.color || '#000000'

      // Replace currentColor in fill/stroke attributes
      const svg = await replaceSvgCurrentColor(iconData.svg, hexColor)

      // Import SVG
      const result = (await sendCommand('import-svg', {
        svg,
        x: Number(args.x),
        y: Number(args.y),
        parentId: args.parent
      })) as { id: string }

      // Rename to icon name
      const iconName = args.name.replace(':', '/')
      await sendCommand('rename-node', { id: result.id, name: iconName })

      // Bind variable to icon fills if specified
      if (varMatch) {
        await sendCommand('bind-fill-variable-by-name', {
          id: result.id,
          variableName: varMatch[1],
          recursive: true
        })
      }

      // Convert to component if requested
      let finalId = result.id
      if (args.component) {
        const componentResult = (await sendCommand('convert-to-component', {
          id: result.id
        })) as { id: string }
        finalId = componentResult.id
      }

      // Get final result
      const finalResult = await sendCommand('get-node-info', { id: finalId })
      printResult(finalResult, args.json, 'create')
    } catch (e) {
      handleError(e)
    }
  }
})
